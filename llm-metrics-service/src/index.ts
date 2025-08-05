import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { register, collectDefaultMetrics } from 'prom-client';
import { LLMMetricsCollector } from './metrics/LLMMetricsCollector';
import { DatabaseService } from './services/DatabaseService';
import { LLMService } from './services/LLMService';
import { RabbitMQConsumerService } from './services/RabbitMQConsumerService';
import { LLMController } from './controllers/LLMController';
import { logger } from './utils/logger';
import { config } from './config/index';

class App {
  private app: express.Application;
  private metricsCollector: LLMMetricsCollector;
  private databaseService: DatabaseService;
  private llmService: LLMService;
  private llmController: LLMController;
  private rabbitMQConsumer: RabbitMQConsumerService;

  constructor() {
    this.app = express();
    this.databaseService = new DatabaseService();
    this.metricsCollector = new LLMMetricsCollector();
    this.llmService = new LLMService(this.metricsCollector, this.databaseService);
    this.llmController = new LLMController(this.llmService);
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
    // Test Express routing fundamentals
    this.app.get('/', (req: Request, res: Response) => {
      logger.info('Root route accessed');
      res.json({ message: 'Root route working', timestamp: new Date().toISOString() });
    });

    this.app.get('/test-basic', (req: Request, res: Response) => {
      logger.info('Basic test route accessed');
      res.json({ message: 'Basic test route working', timestamp: new Date().toISOString() });
    });

    // Health check endpoint with Twitter/RabbitMQ status
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        logger.info('Health check accessed');
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
        logger.info('Metrics endpoint accessed');
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error('Error generating metrics', error);
        res.status(500).end();
      }
    });

    // Test route to debug controller issues
    this.app.get('/api/test', (req: Request, res: Response) => {
      logger.info('API test route accessed');
      res.json({ message: 'Test route working', timestamp: new Date().toISOString() });
    });

    // Simple test route that bypasses controller
    this.app.get('/api/simple-test', (req: Request, res: Response) => {
      logger.info('API simple test route accessed');
      res.json({ message: 'Simple test route working', timestamp: new Date().toISOString() });
    });

    // LLM metrics endpoints using controller - simplified
    this.app.get('/api/llm/health', (req: Request, res: Response) => {
      logger.info('LLM health check accessed');
      res.json({ 
        status: 'healthy', 
        service: 'llm-metrics',
        timestamp: new Date().toISOString() 
      });
    });

    this.app.get('/api/llm/metrics', (req: Request, res: Response) => {
      logger.info('LLM metrics endpoint accessed');
      res.json({ 
        message: 'LLM metrics endpoint working',
        timestamp: new Date().toISOString() 
      });
    });

    // Fix controller binding using arrow functions instead of .bind()
    // LLM interaction endpoints using controller
    this.app.post('/api/llm/chat', async (req: Request, res: Response) => {
      logger.info('LLM chat endpoint accessed');
      await this.llmController.generateResponse(req, res);
    });
    
    this.app.post('/api/llm/generate', async (req: Request, res: Response) => {
      logger.info('LLM generate endpoint accessed');
      await this.llmController.generateResponse(req, res);
    });

    // Legacy endpoints for backward compatibility - fixed binding
    this.app.get('/api/metrics/llm/summary', async (req: Request, res: Response) => {
      logger.info('LLM summary endpoint accessed');
      await this.llmController.getMetrics(req, res);
    });
    
    this.app.get('/api/metrics/llm/costs', async (req: Request, res: Response) => {
      logger.info('LLM costs endpoint accessed');
      await this.llmController.getCostBreakdown(req, res);
    });

    // Demo endpoint for generating sample metrics
    this.app.post('/api/demo/generate-metrics', async (req: Request, res: Response) => {
      try {
        logger.info('Demo metrics generation accessed');
        const { count = 10, includeErrors = false } = req.body;
        const results = await this.generateDemoMetrics(count, includeErrors);
        res.json({
          message: `Generated ${results.length} demo metrics`,
          results: results.slice(0, 5), // Return first 5 for preview
        });
      } catch (error) {
        logger.error('Error generating demo metrics', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // IMPORTANT: 404 handler must be LAST - after all route definitions
    this.app.use('*', (req: Request, res: Response) => {
      logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
      res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Error handler must be LAST
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private async generateDemoMetrics(count: number, includeErrors: boolean = false): Promise<any[]> {
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

      // Simulate errors for 50% of requests when includeErrors is true (increased for testing)
      const shouldSimulateError = includeErrors && Math.random() < 0.5;

      if (shouldSimulateError) {
        // Generate error metrics manually
        const requestId = require('uuid').v4();
        const errorMetrics = {
          requestId,
          model,
          promptTokens: this.estimateTokens(prompt),
          completionTokens: 0,
          totalTokens: this.estimateTokens(prompt),
          timeToFirstToken: 0,
          tokensPerSecond: 0,
          totalDuration: 2.5 + Math.random() * 2, // 2.5-4.5 seconds for timeout
          costUsd: 0,
          status: 'error' as const,
          errorMessage: 'API rate limit exceeded',
          userId,
          endpoint: '/api/llm/chat',
        };

        // Record the error metrics
        await this.databaseService.saveLLMMetrics(errorMetrics);
        this.metricsCollector.recordMetrics(errorMetrics);
        
        results.push({
          requestId,
          status: 'error',
          errorMessage: 'API rate limit exceeded',
          model,
          userId
        });
      } else {
        try {
          const result = await this.llmService.generateCompletion(prompt, model, userId);
          results.push(result);
        } catch (error) {
          logger.error(`Error generating demo metric ${i}`, error);
        }
      }
      
      // Add small delay to simulate realistic usage
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
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
