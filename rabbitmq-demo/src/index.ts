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
      await this.channel.assertExchange('twitter.exchange', 'topic', { durable: true });

      // Declare queues
      await this.channel.assertQueue('orders.processing', { durable: true });
      await this.channel.assertQueue('orders.completed', { durable: true });
      await this.channel.assertQueue('notifications.email', { durable: true });
      await this.channel.assertQueue('notifications.sms', { durable: true });
      await this.channel.assertQueue('analytics.user-behavior', { durable: true });
      await this.channel.assertQueue('analytics.system-metrics', { durable: true });
      await this.channel.assertQueue('twitter.nvidia', { durable: true });
      await this.channel.assertQueue('twitter.mentions', { durable: true });
      await this.channel.assertQueue('twitter.trends', { durable: true });

      // Bind queues to exchanges
      await this.channel.bindQueue('orders.processing', 'orders.exchange', 'new');
      await this.channel.bindQueue('orders.completed', 'orders.exchange', 'completed');
      await this.channel.bindQueue('notifications.email', 'notifications.exchange', '');
      await this.channel.bindQueue('notifications.sms', 'notifications.exchange', '');
      await this.channel.bindQueue('analytics.user-behavior', 'analytics.exchange', 'user.*');
      await this.channel.bindQueue('analytics.system-metrics', 'analytics.exchange', 'system.*');
      await this.channel.bindQueue('twitter.nvidia', 'twitter.exchange', 'twitter.NVIDIA');
      await this.channel.bindQueue('twitter.mentions', 'twitter.exchange', 'twitter.mentions.*');
      await this.channel.bindQueue('twitter.trends', 'twitter.exchange', 'twitter.trends.*');

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

    // Twitter/NVIDIA producer
    setInterval(() => {
      this.publishTwitterMessage();
    }, 5000);

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

    // Twitter consumers
    await this.channel.consume('twitter.nvidia', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Processing NVIDIA Twitter message: ${msg.content.toString()}`);
        this.channel?.ack(msg);
      }
    });

    await this.channel.consume('twitter.mentions', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Processing Twitter mentions: ${msg.content.toString()}`);
        this.channel?.ack(msg);
      }
    });

    await this.channel.consume('twitter.trends', (msg: amqplib.ConsumeMessage | null) => {
      if (msg) {
        logger.info(`Processing Twitter trends: ${msg.content.toString()}`);
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

  private publishTwitterMessage(): void {
    if (!this.channel) return;

    // Check if we have Twitter API keys
    if (!this.twitterConfig.apiKey || !this.twitterConfig.apiSecret) {
      logger.warn('Twitter API keys not configured, generating simulated messages');
    }

    // Generate different types of NVIDIA-related Twitter messages
    const messageTypes = ['tweet', 'mention', 'trend'];
    const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];

    let routingKey: string;
    let message: any;

    switch (messageType) {
      case 'tweet':
        routingKey = 'twitter.NVIDIA';
        message = this.generateNVIDIATweet();
        break;
      case 'mention':
        routingKey = 'twitter.mentions.NVIDIA';
        message = this.generateNVIDIAMention();
        break;
      case 'trend':
        routingKey = 'twitter.trends.NVIDIA';
        message = this.generateNVIDIATrend();
        break;
      default:
        return;
    }

    this.channel.publish('twitter.exchange', routingKey, Buffer.from(JSON.stringify(message)));
    logger.info(`Published Twitter message: ${routingKey}`, { messageId: message.id });
  }

  private generateNVIDIATweet(): any {
    const tweets = [
      "Breaking: NVIDIA announces new AI chip architecture with 50% performance improvement! #NVIDIA #AI #Tech",
      "NVIDIA's latest GPU delivers unprecedented gaming performance. Gamers rejoice! #NVIDIA #Gaming #GPU",
      "NVIDIA stock hits new all-time high as AI demand surges #NVIDIA #Stocks #AI",
      "NVIDIA partners with major cloud providers for next-gen AI infrastructure #NVIDIA #Cloud #AI",
      "New NVIDIA developer tools making AI more accessible to everyone #NVIDIA #Developer #AI"
    ];

    return {
      id: Math.floor(Math.random() * 1000000),
      type: 'tweet',
      topic: 'NVIDIA',
      text: tweets[Math.floor(Math.random() * tweets.length)],
      author: {
        username: 'nvidia_official',
        followers: 2500000 + Math.floor(Math.random() * 100000),
      },
      engagement: {
        likes: Math.floor(Math.random() * 10000),
        retweets: Math.floor(Math.random() * 5000),
        replies: Math.floor(Math.random() * 1000),
      },
      timestamp: new Date().toISOString(),
      sentiment: Math.random() > 0.3 ? 'positive' : 'neutral',
      metadata: {
        hasTwitterKeys: !!(this.twitterConfig.apiKey && this.twitterConfig.apiSecret),
        source: 'rabbitmq-demo'
      }
    };
  }

  private generateNVIDIAMention(): any {
    const mentions = [
      "Just upgraded to @NVIDIA RTX 4090, the performance is incredible! #NVIDIA",
      "Thanks @NVIDIA for the amazing developer support at the AI conference! #AI #NVIDIA",
      "@NVIDIA's CUDA toolkit just saved me hours of development time! #CUDA #NVIDIA",
      "Can't wait for @NVIDIA's next announcement at GTC! #GTC #NVIDIA",
      "@NVIDIA leading the AI revolution, one GPU at a time! #AI #NVIDIA"
    ];

    return {
      id: Math.floor(Math.random() * 1000000),
      type: 'mention',
      topic: 'NVIDIA',
      text: mentions[Math.floor(Math.random() * mentions.length)],
      author: {
        username: `user_${Math.floor(Math.random() * 10000)}`,
        followers: Math.floor(Math.random() * 50000),
      },
      mentionedUser: 'NVIDIA',
      engagement: {
        likes: Math.floor(Math.random() * 1000),
        retweets: Math.floor(Math.random() * 500),
        replies: Math.floor(Math.random() * 100),
      },
      timestamp: new Date().toISOString(),
      sentiment: Math.random() > 0.2 ? 'positive' : Math.random() > 0.5 ? 'neutral' : 'negative',
      metadata: {
        hasTwitterKeys: !!(this.twitterConfig.apiKey && this.twitterConfig.apiSecret),
        source: 'rabbitmq-demo'
      }
    };
  }

  private generateNVIDIATrend(): any {
    const trends = [
      '#NVIDIA',
      '#NVIDIAEarnings',
      '#NVIDIAAI',
      '#RTX4090',
      '#NVIDIAGPU',
      '#NVIDIADeveloper',
      '#CUDAI',
      '#NVIDIAStock'
    ];

    return {
      id: Math.floor(Math.random() * 1000000),
      type: 'trend',
      topic: 'NVIDIA',
      hashtag: trends[Math.floor(Math.random() * trends.length)],
      tweetVolume: Math.floor(Math.random() * 100000) + 10000,
      rank: Math.floor(Math.random() * 50) + 1,
      location: 'Worldwide',
      timestamp: new Date().toISOString(),
      relatedTopics: ['AI', 'GPU', 'Gaming', 'Technology', 'Stocks'],
      metadata: {
        hasTwitterKeys: !!(this.twitterConfig.apiKey && this.twitterConfig.apiSecret),
        source: 'rabbitmq-demo'
      }
    };
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
