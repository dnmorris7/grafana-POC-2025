import { Request, Response } from 'express';
import { LLMService } from '../services/LLMService';
import { logger } from '../utils/logger';

export class LLMController {
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  // Endpoint to interact with LLM and capture metrics
  public async generateResponse(req: Request, res: Response): Promise<void> {
    try {
      const { prompt, model = 'gpt-3.5-turbo', userId = 'demo-user', maxTokens = 500, temperature = 0.7 } = req.body;

      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      const result = await this.llmService.generateCompletion(
        prompt, 
        model, 
        userId, 
        maxTokens, 
        temperature
      );

      res.json({
        success: true,
        requestId: result.requestId,
        response: result.response,
        metrics: {
          timeToFirstToken: result.metrics.timeToFirstToken,
          tokensPerSecond: result.metrics.tokensPerSecond,
          totalDuration: result.metrics.totalDuration,
          tokenUsage: {
            promptTokens: result.metrics.promptTokens,
            completionTokens: result.metrics.completionTokens,
            totalTokens: result.metrics.totalTokens
          },
          cost: result.metrics.cost
        },
        model: result.model,
        status: result.status
      });

    } catch (error) {
      logger.error('LLM generation failed', error);
      res.status(500).json({ 
        success: false, 
        error: 'LLM generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Endpoint to get LLM metrics dashboard data
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = '1h', model } = req.query;
      
      const metrics = await this.llmService.getMetricsSummary(
        timeRange as string, 
        model as string
      );

      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get LLM metrics', error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  }

  // Endpoint to get cost breakdown
  public async getCostBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange = '24h', groupBy = 'hour' } = req.query;
      
      const costs = await this.llmService.getCostBreakdown(
        timeRange as string,
        groupBy as string
      );

      res.json(costs);
    } catch (error) {
      logger.error('Failed to get cost breakdown', error);
      res.status(500).json({ error: 'Failed to retrieve cost breakdown' });
    }
  }

  // Health check specifically for LLM service
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.llmService.healthCheck();
      res.json(health);
    } catch (error) {
      logger.error('LLM health check failed', error);
      res.status(503).json({ 
        status: 'unhealthy',
        error: 'LLM service health check failed'
      });
    }
  }
}
