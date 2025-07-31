import amqplib from 'amqplib';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

class RabbitMQDemo {
  private connection: Awaited<ReturnType<typeof amqplib.connect>> | null = null;
  private channel: Awaited<ReturnType<NonNullable<typeof this.connection>['createChannel']>> | null = null;
  private readonly rabbitmqUrl: string;
  private readonly twitterConfig: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
    bearerToken: string;
  };

  constructor() {
    this.rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    this.twitterConfig = {
      apiKey: process.env.TWITTER_API_KEY || '',
      apiSecret: process.env.TWITTER_API_SECRET || '',
      accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
    };
    
    logger.info('RabbitMQ Demo initialized', {
      rabbitmqUrl: this.rabbitmqUrl,
      hasTwitterKeys: !!(this.twitterConfig.apiKey && this.twitterConfig.apiSecret)
    });
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ...');
      this.connection = await amqplib.connect(this.rabbitmqUrl);

      // Create channel after connection
      if (!this.connection) {
        throw new Error('RabbitMQ connection is not established');
      }
      this.channel = await this.connection.createChannel();

      // Setup error handlers
      if (this.connection) {
        this.connection.on('error', (err: Error) => {
          logger.error('Connection error:', err);
        });

        this.connection.on('close', () => {
          logger.info('Connection closed');
        });
      }

      logger.info('Connected to RabbitMQ successfully');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async setupTopology(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    try {
      // Declare exchanges
      await this.channel.assertExchange('orders.exchange', 'direct', { durable: true });
      await this.channel.assertExchange('notifications.exchange', 'fanout', { durable: true });
      await this.channel.assertExchange('analytics.exchange', 'topic', { durable: true });

      // Declare queues
      await this.channel.assertQueue('orders.processing', { durable: true });
      await this.channel.assertQueue('orders.completed', { durable: true });
      await this.channel.assertQueue('notifications.email', { durable: true });
      await this.channel.assertQueue('notifications.sms', { durable: true });
      await this.channel.assertQueue('analytics.user-behavior', { durable: true });
      await this.channel.assertQueue('analytics.system-metrics', { durable: true });

      // Bind queues to exchanges
      await this.channel.bindQueue('orders.processing', 'orders.exchange', 'new');
      await this.channel.bindQueue('orders.completed', 'orders.exchange', 'completed');
      await this.channel.bindQueue('notifications.email', 'notifications.exchange', '');
      await this.channel.bindQueue('notifications.sms', 'notifications.exchange', '');
      await this.channel.bindQueue('analytics.user-behavior', 'analytics.exchange', 'user.*');
      await this.channel.bindQueue('analytics.system-metrics', 'analytics.exchange', 'system.*');

      logger.info('RabbitMQ topology setup completed');
    } catch (error) {
      logger.error('Failed to setup topology:', error);
      throw error;
    }
  }

  async startProducers(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    // Order producer
    setInterval(() => {
      this.publishOrderMessage();
    }, 2000);

    // Notification producer
    setInterval(() => {
      this.publishNotificationMessage();
    }, 3000);

    // Analytics producer
    setInterval(() => {
      this.publishAnalyticsMessage();
    }, 1500);

    logger.info('Started message producers');
  }

  async startConsumers(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    // Order processing consumer
    await this.channel.consume('orders.processing', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Processing order: ${msg.content.toString()}`);
        this.channel?.ack(msg);
        
        // Simulate processing time
        setTimeout(() => {
          // Publish completed order
          this.channel?.publish('orders.exchange', 'completed', 
            Buffer.from(JSON.stringify({ orderId: JSON.parse(msg.content.toString()).orderId, status: 'completed' })));
        }, 1000 + Math.random() * 2000);
      }
    });

    // Email notification consumer
    await this.channel.consume('notifications.email', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Sending email: ${msg.content.toString()}`);
        this.channel?.ack(msg);
      }
    });

    // SMS notification consumer
    await this.channel.consume('notifications.sms', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Sending SMS: ${msg.content.toString()}`);
        this.channel?.ack(msg);
      }
    });

    // Analytics consumers
    await this.channel.consume('analytics.user-behavior', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Processing user analytics: ${msg.content.toString()}`);
        this.channel?.ack(msg);
      }
    });

    await this.channel.consume('analytics.system-metrics', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Processing system metrics: ${msg.content.toString()}`);
        this.channel?.ack(msg);
      }
    });

    logger.info('Started message consumers');
  }

  private publishOrderMessage(): void {
    if (!this.channel) return;

    const orderId = Math.floor(Math.random() * 100000);
    const order = {
      orderId,
      customerId: Math.floor(Math.random() * 1000),
      amount: Math.floor(Math.random() * 500) + 10,
      timestamp: new Date().toISOString(),
    };

    this.channel.publish('orders.exchange', 'new', Buffer.from(JSON.stringify(order)));
    logger.debug(`Published order: ${orderId}`);
  }

  private publishNotificationMessage(): void {
    if (!this.channel) return;

    const notification = {
      type: Math.random() > 0.5 ? 'order_confirmation' : 'shipping_update',
      userId: Math.floor(Math.random() * 1000),
      message: 'Your order has been updated',
      timestamp: new Date().toISOString(),
    };

    this.channel.publish('notifications.exchange', '', Buffer.from(JSON.stringify(notification)));
    logger.debug('Published notification');
  }

  private publishAnalyticsMessage(): void {
    if (!this.channel) return;

    const eventTypes = ['user.login', 'user.purchase', 'user.view', 'system.cpu', 'system.memory'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    const event = {
      eventType,
      data: {
        value: Math.random() * 100,
        metadata: { source: 'demo' },
      },
      timestamp: new Date().toISOString(),
    };

    this.channel.publish('analytics.exchange', eventType, Buffer.from(JSON.stringify(event)));
    logger.debug(`Published analytics event: ${eventType}`);
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing connection:', error);
    }
  }
}

async function main() {
  const demo = new RabbitMQDemo();

  try {
    await demo.connect();
    await demo.setupTopology();
    await demo.startConsumers();
    await demo.startProducers();

    logger.info('RabbitMQ demo started successfully');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await demo.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await demo.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start RabbitMQ demo:', error);
    process.exit(1);
  }
}

main();
