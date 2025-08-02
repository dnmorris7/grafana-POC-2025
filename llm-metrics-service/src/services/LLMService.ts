import { v4 as uuidv4 } from 'uuid';
import { LLMMetricsCollector, LLMMetrics } from '../metrics/LLMMetricsCollector';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import { config } from '../config/index';

export interface LLMCompletionRequest {
  prompt: string;
  model: string;
  userId: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionResponse {
  requestId: string;
  response: string;
  metrics: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    timeToFirstToken: number;
    tokensPerSecond: number;
    totalDuration: number;
    cost: number;
  };
  model: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

// Model pricing per 1K tokens (input/output)
const MODEL_PRICING: { [key: string]: { input: number; output: number } } = {
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
};

export class LLMService {
  private metricsCollector: LLMMetricsCollector;
  private databaseService: DatabaseService;

  constructor(
    metricsCollector: LLMMetricsCollector,
    databaseService: DatabaseService
  ) {
    this.metricsCollector = metricsCollector;
    this.databaseService = databaseService;
  }

  public async generateCompletion(
    prompt: string,
    model: string = 'gpt-3.5-turbo',
    userId: string = 'anonymous',
    maxTokens: number = 1000,
    temperature: number = 0.7
  ): Promise<LLMCompletionResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();
    const endpoint = '/api/llm/chat';

    // Increment active requests metric
    this.metricsCollector.incrementActiveRequests(model, endpoint);

    try {
      logger.info('Starting LLM completion', {
        requestId,
        model,
        userId,
        promptLength: prompt.length,
      });

      // Simulate LLM API call with realistic metrics
      const result = await this.simulateLLMCall(
        prompt,
        model,
        maxTokens,
        temperature
      );

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000; // Convert to seconds

      // Calculate metrics
      const promptTokens = this.estimateTokens(prompt);
      const completionTokens = this.estimateTokens(result.response);
      const totalTokens = promptTokens + completionTokens;
      const cost = this.calculateCost(model, promptTokens, completionTokens);
      const tokensPerSecond = completionTokens / Math.max(totalDuration - result.timeToFirstToken, 0.1);

      const metrics: LLMMetrics = {
        requestId,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        timeToFirstToken: result.timeToFirstToken,
        tokensPerSecond,
        totalDuration,
        costUsd: cost,
        status: 'success',
        userId,
        endpoint,
      };

      // Record metrics
      this.metricsCollector.recordMetrics(metrics);
      await this.databaseService.saveLLMMetrics(metrics);

      logger.info('LLM completion successful', {
        requestId,
        totalDuration,
        totalTokens,
        cost,
      });

      return {
        requestId,
        response: result.response,
        metrics: {
          promptTokens,
          completionTokens,
          totalTokens,
          timeToFirstToken: result.timeToFirstToken,
          tokensPerSecond,
          totalDuration,
          cost,
        },
        model,
        status: 'success',
      };
    } catch (error) {
      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const metrics: LLMMetrics = {
        requestId,
        model,
        promptTokens: this.estimateTokens(prompt),
        completionTokens: 0,
        totalTokens: this.estimateTokens(prompt),
        timeToFirstToken: 0,
        tokensPerSecond: 0,
        totalDuration,
        costUsd: 0,
        status: 'error',
        errorMessage,
        userId,
        endpoint,
      };

      // Record error metrics
      this.metricsCollector.recordMetrics(metrics);
      await this.databaseService.saveLLMMetrics(metrics);

      logger.error('LLM completion failed', {
        requestId,
        error: errorMessage,
        totalDuration,
      });

      return {
        requestId,
        response: '',
        metrics: {
          promptTokens: metrics.promptTokens,
          completionTokens: 0,
          totalTokens: metrics.totalTokens,
          timeToFirstToken: 0,
          tokensPerSecond: 0,
          totalDuration,
          cost: 0,
        },
        model,
        status: 'error',
        errorMessage,
      };
    } finally {
      // Decrement active requests metric
      this.metricsCollector.decrementActiveRequests(model, endpoint);
    }
  }

  private async simulateLLMCall(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number
  ): Promise<{ response: string; timeToFirstToken: number }> {
    // Simulate different response times based on model
    const baseLatency = this.getModelBaseLatency(model);
    const timeToFirstToken = baseLatency + Math.random() * 0.5; // 0-500ms additional variance

    // Simulate time to first token
    await new Promise(resolve => setTimeout(resolve, timeToFirstToken * 1000));

    // Generate a realistic response based on prompt
    const response = this.generateMockResponse(prompt, model);

    // Simulate token generation time (realistic streaming)
    const estimatedTokens = Math.min(this.estimateTokens(response), maxTokens);
    const tokenGenerationTime = estimatedTokens * (0.02 + Math.random() * 0.01); // 20-30ms per token
    await new Promise(resolve => setTimeout(resolve, tokenGenerationTime * 1000));

    return {
      response,
      timeToFirstToken,
    };
  }

  private getModelBaseLatency(model: string): number {
    const latencies: { [key: string]: number } = {
      'gpt-3.5-turbo': 0.3,
      'gpt-4': 0.8,
      'gpt-4-turbo': 0.5,
      'gpt-4o': 0.4,
    };
    return latencies[model] || 0.5;
  }

  private generateMockResponse(prompt: string, model: string): string {
    const responses = [
      'This is a comprehensive response to your query. The answer involves multiple considerations and requires a detailed explanation.',
      'Based on your question, I can provide the following insights and recommendations for your specific use case.',
      'Here\'s a detailed analysis of the topic you\'ve asked about, including relevant examples and best practices.',
      'To address your question effectively, let me break down the key components and provide a structured response.',
      'Your inquiry touches on several important aspects. Here\'s a thorough examination of each relevant factor.',
    ];

    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Add some variation based on model (GPT-4 generates longer responses)
    const modelMultiplier = model.includes('gpt-4') ? 1.5 : 1;
    const responseLength = Math.floor(baseResponse.length * modelMultiplier * (0.8 + Math.random() * 0.4));
    
    return baseResponse + ' '.repeat(Math.max(0, responseLength - baseResponse.length)) + 
           'This response demonstrates the capabilities of the ' + model + ' model in generating contextual content.';
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      logger.warn(`No pricing found for model: ${model}, using default`);
      return 0.001; // Default minimal cost
    }

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  // Get metrics summary for dashboard
  public async getMetricsSummary(timeRange: string = '1h', model?: string) {
    try {
      return await this.databaseService.getLLMMetricsSummary(timeRange, model);
    } catch (error) {
      logger.error('Failed to get metrics summary', error);
      throw error;
    }
  }

  // Get cost breakdown for dashboard
  public async getCostBreakdown(timeRange: string = '24h', groupBy: string = 'hour') {
    try {
      return await this.databaseService.getLLMCostBreakdown(timeRange, groupBy);
    } catch (error) {
      logger.error('Failed to get cost breakdown', error);
      throw error;
    }
  }

  // Health check for LLM service
  public async healthCheck() {
    try {
      // Check if we can connect to database
      const dbStatus = await this.databaseService.healthCheck();
      
      // Basic configuration check
      const configStatus = {
        hasApiKey: !!config.openai?.apiKey && config.openai.apiKey !== 'demo_key',
        modelsAvailable: Object.keys(MODEL_PRICING).length > 0
      };

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        configuration: configStatus,
        models: Object.keys(MODEL_PRICING)
      };
    } catch (error) {
      logger.error('LLM service health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
