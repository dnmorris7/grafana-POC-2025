import * as amqp from 'amqplib';
import { Pool } from 'pg';

interface TwitterMessage {
  id: string;
  type: string;
  topic: string;
  text?: string;
  hashtag?: string;
  author?: {
    username: string;
    followers: number;
  };
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
  sentiment?: string;
  timestamp: string;
}

export class RabbitMQConsumerService {
  private connection: any = null;
  private channel: any = null;
  private dbPool: Pool;

  constructor() {
    // Initialize database connection pool
    this.dbPool = new Pool({
      host: process.env.TIMESCALE_HOST || 'timescaledb',
      port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      database: process.env.TIMESCALE_DB || 'metrics',
      user: process.env.TIMESCALE_USER || 'prometheus',
      password: process.env.TIMESCALE_PASSWORD || 'prometheus_password',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      console.log('✅ Connected to RabbitMQ for consuming');
      
      // Set up queue and start consuming
      await this.setupConsumer();
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  private async setupConsumer(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    // Declare the exchange and queue (should already exist from producer)
    await this.channel.assertExchange('twitter.exchange', 'topic', { durable: true });
    await this.channel.assertQueue('twitter.nvidia', { durable: true });
    
    // Bind the queue to the exchange with the NVIDIA routing key
    await this.channel.bindQueue('twitter.nvidia', 'twitter.exchange', 'twitter.nvidia.*');

    // Start consuming messages
    await this.channel.consume('twitter.nvidia', async (msg: any) => {
      if (msg) {
        try {
          const messageContent = msg.content.toString();
          const twitterMessage: TwitterMessage = JSON.parse(messageContent);
          
          console.log('📥 Received Twitter message:', {
            id: twitterMessage.id,
            type: twitterMessage.type,
            topic: twitterMessage.topic,
            sentiment: twitterMessage.sentiment,
            likes: twitterMessage.engagement?.likes
          });

          // Store in database
          await this.storeMessageInDatabase(twitterMessage, msg.fields.routingKey || '');
          
          // Acknowledge the message
          this.channel!.ack(msg);
          
        } catch (error) {
          console.error('❌ Error processing message:', error);
          // Reject the message (it will be requeued)
          this.channel!.nack(msg, false, true);
        }
      }
    });

    console.log('🎧 Waiting for Twitter messages. Press Ctrl+C to exit');
  }

  private async storeMessageInDatabase(message: TwitterMessage, routingKey: string): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      const query = `
        INSERT INTO metrics.twitter_metrics (
          message_id, message_type, topic, text, hashtag,
          author_username, author_followers, likes, retweets, replies,
          sentiment, routing_key, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      const values = [
        parseInt(message.id),
        message.type,
        message.topic,
        message.text || null,
        message.hashtag || null,
        message.author?.username || null,
        message.author?.followers || null,
        message.engagement?.likes || 0,
        message.engagement?.retweets || 0,
        message.engagement?.replies || 0,
        message.sentiment || null,
        routingKey,
        new Date(message.timestamp)
      ];

      await client.query(query, values);
      
      console.log('💾 Stored Twitter message in database:', {
        id: message.id,
        topic: message.topic,
        sentiment: message.sentiment,
        likes: message.engagement?.likes
      });
      
    } catch (error) {
      console.error('❌ Database error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      await this.dbPool.end();
      console.log('🔌 Disconnected from RabbitMQ and database');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  // Health check method
  async healthCheck(): Promise<{ rabbitmq: boolean; database: boolean }> {
    const isConnectionOpen = this.connection !== null;
    const isDatabaseConnected = this.dbPool.totalCount >= 0;
    
    return {
      rabbitmq: isConnectionOpen,
      database: isDatabaseConnected
    };
  }
}
