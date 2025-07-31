import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { register, collectDefaultMetrics } from 'prom-client';
import { LLMMetricsCollector } from './metrics/LLMMetricsCollector';
import { DatabaseService } from './services/DatabaseService';
import { LLMService } from './services/LLMService';
import { RabbitMQConsumerService } from './services/RabbitMQConsumerService';
import { logger } from './utils/logger';
import { config } from './config/index';

class App {
  private app: express.Application;
  private metricsCollector: LLMMetricsCollector;
  private databaseService: DatabaseService;
  private llmService: LLMService;
  private rabbitMQConsumer: RabbitMQConsumerService;

  constructor() {
    this.app = express();
    this.databaseService = new DatabaseService();
    this.metricsCollector = new LLMMetricsCollector();
    this.llmService = new LLMService(this.metricsCollector, this.databaseService);
    this.rabbitMQConsumer = new RabbitMQConsumerService();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupMetrics();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupMetrics(): void {
    // Collect default Node.js metrics
    collectDefaultMetrics({ register });
  }

  private setupRoutes(): void {
    // Health check endpoint with Twitter/RabbitMQ status
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        // TODO: Re-enable when RabbitMQ consumer is working
        // const rabbitMQHealth = await this.rabbitMQConsumer.healthCheck();
        
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          services: {
            database: true, // Assuming healthy if we reach this point
            rabbitmq: false, // Temporarily disabled
            twitterConsumer: false, // Temporarily disabled
          }
        });
      } catch (error) {
        logger.error('Health check failed', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Service health check failed'
        });
      }
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error('Error generating metrics', error);
        res.status(500).end();
      }
    });

    // LLM interaction endpoints
    this.app.post('/api/llm/chat', async (req: Request, res: Response) => {
      try {
        const { prompt, model = 'gpt-3.5-turbo', userId = 'anonymous' } = req.body;
        
        if (!prompt) {
          return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await this.llmService.generateCompletion(prompt, model, userId);
        res.json(result);
      } catch (error) {
        logger.error('Error in LLM chat endpoint', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // LLM metrics query endpoints
    this.app.get('/api/metrics/llm/summary', async (req: Request, res: Response) => {
      try {
        const { timeRange = '1h', model } = req.query;
        const summary = await this.databaseService.getLLMMetricsSummary(
          timeRange as string,
          model as string
        );
        res.json(summary);
      } catch (error) {
        logger.error('Error fetching LLM metrics summary', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/metrics/llm/costs', async (req: Request, res: Response) => {
      try {
        const { timeRange = '24h', groupBy = 'hour' } = req.query;
        const costs = await this.databaseService.getLLMCostBreakdown(
          timeRange as string,
          groupBy as string
        );
        res.json(costs);
      } catch (error) {
        logger.error('Error fetching LLM cost breakdown', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Demo endpoint for generating sample metrics
    this.app.post('/api/demo/generate-metrics', async (req: Request, res: Response) => {
      try {
        const { count = 10 } = req.body;
        const results = await this.generateDemoMetrics(count);
        res.json({
          message: `Generated ${results.length} demo metrics`,
          results: results.slice(0, 5), // Return first 5 for preview
        });
      } catch (error) {
        logger.error('Error generating demo metrics', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private async generateDemoMetrics(count: number): Promise<any[]> {
    const models = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
    const samplePrompts = [
      'Explain quantum computing',
      'Write a Python function to sort a list',
      'What is machine learning?',
      'Describe the water cycle',
      'How does blockchain work?',
    ];

    const results = [];
    
    for (let i = 0; i < count; i++) {
      const model = models[Math.floor(Math.random() * models.length)];
      const prompt = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
      const userId = `demo-user-${Math.floor(Math.random() * 5) + 1}`;

      try {
        const result = await this.llmService.generateCompletion(prompt, model, userId);
        results.push(result);
        
        // Add small delay to simulate realistic usage
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error generating demo metric ${i}`, error);
      }
    }

    return results;
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await this.databaseService.initialize();
      logger.info('Database service initialized');

      // Initialize RabbitMQ consumer for Twitter messages
      await this.rabbitMQConsumer.connect();
      logger.info('RabbitMQ consumer service connected and ready');

      // Start the server
      const port = config.port;
      this.app.listen(port, () => {
        logger.info(`LLM Metrics Service started on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`Metrics: http://localhost:${port}/metrics`);
        logger.info(`API Documentation: http://localhost:${port}/api`);
        logger.info(`Twitter/NVIDIA messages pipeline ready for connection`);
      });
    } catch (error) {
      logger.error('Failed to start application', error);
      process.exit(1);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down services...');
      // TODO: Re-enable when RabbitMQ consumer is working
      // await this.rabbitMQConsumer.disconnect();
      await this.databaseService.close();
      logger.info('All services shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown', error);
    }
  }
}

// Start the application
const app = new App();
app.start().catch((error) => {
  logger.error('Failed to start application', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.shutdown();
  process.exit(0);
});
