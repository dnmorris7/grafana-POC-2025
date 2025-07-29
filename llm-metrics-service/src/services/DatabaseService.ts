import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { LLMMetrics } from '../metrics/LLMMetricsCollector';

export interface LLMMetricsSummary {
  totalRequests: number;
  successRate: number;
  avgTimeToFirstToken: number;
  avgTokensPerSecond: number;
  avgTotalDuration: number;
  totalCost: number;
  avgTokensPerRequest: number;
  errorCount: number;
}

export interface CostBreakdown {
  timestamp: string;
  model: string;
  totalCost: number;
  requestCount: number;
  avgCostPerRequest: number;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  public async saveLLMMetrics(metrics: LLMMetrics): Promise<void> {
    const query = `
      INSERT INTO metrics.llm_metrics (
        request_id, model, prompt_tokens, completion_tokens, total_tokens,
        time_to_first_token, tokens_per_second, total_duration, cost_usd,
        status, error_message, user_id, endpoint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    const values = [
      metrics.requestId,
      metrics.model,
      metrics.promptTokens,
      metrics.completionTokens,
      metrics.totalTokens,
      metrics.timeToFirstToken,
      metrics.tokensPerSecond,
      metrics.totalDuration,
      metrics.costUsd,
      metrics.status,
      metrics.errorMessage || null,
      metrics.userId,
      metrics.endpoint,
    ];

    try {
      await this.pool.query(query, values);
      logger.debug('LLM metrics saved to database', { requestId: metrics.requestId });
    } catch (error) {
      logger.error('Failed to save LLM metrics to database', error);
      throw error;
    }
  }

  public async getLLMMetricsSummary(
    timeRange: string = '1h',
    model?: string
  ): Promise<LLMMetricsSummary> {
    const timeInterval = this.parseTimeRange(timeRange);
    let query = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::float / COUNT(*)::float as success_rate,
        AVG(CASE WHEN status = 'success' THEN time_to_first_token END) as avg_time_to_first_token,
        AVG(CASE WHEN status = 'success' THEN tokens_per_second END) as avg_tokens_per_second,
        AVG(CASE WHEN status = 'success' THEN total_duration END) as avg_total_duration,
        SUM(CASE WHEN status = 'success' THEN cost_usd ELSE 0 END) as total_cost,
        AVG(CASE WHEN status = 'success' THEN total_tokens END) as avg_tokens_per_request,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count
      FROM metrics.llm_metrics
      WHERE time >= NOW() - INTERVAL '${timeInterval}'
    `;

    const params: any[] = [];
    if (model) {
      query += ' AND model = $1';
      params.push(model);
    }

    try {
      const result = await this.pool.query(query, params);
      const row = result.rows[0];

      return {
        totalRequests: parseInt(row.total_requests) || 0,
        successRate: parseFloat(row.success_rate) || 0,
        avgTimeToFirstToken: parseFloat(row.avg_time_to_first_token) || 0,
        avgTokensPerSecond: parseFloat(row.avg_tokens_per_second) || 0,
        avgTotalDuration: parseFloat(row.avg_total_duration) || 0,
        totalCost: parseFloat(row.total_cost) || 0,
        avgTokensPerRequest: parseFloat(row.avg_tokens_per_request) || 0,
        errorCount: parseInt(row.error_count) || 0,
      };
    } catch (error) {
      logger.error('Failed to get LLM metrics summary', error);
      throw error;
    }
  }

  public async getLLMCostBreakdown(
    timeRange: string = '24h',
    groupBy: string = 'hour'
  ): Promise<CostBreakdown[]> {
    const timeInterval = this.parseTimeRange(timeRange);
    const bucketInterval = groupBy === 'hour' ? '1 hour' : '1 day';

    const query = `
      SELECT 
        time_bucket('${bucketInterval}', time) as timestamp,
        model,
        SUM(cost_usd) as total_cost,
        COUNT(*) as request_count,
        AVG(cost_usd) as avg_cost_per_request
      FROM metrics.llm_metrics
      WHERE time >= NOW() - INTERVAL '${timeInterval}'
        AND status = 'success'
      GROUP BY timestamp, model
      ORDER BY timestamp DESC, model
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows.map((row: any) => ({
        timestamp: row.timestamp,
        model: row.model,
        totalCost: parseFloat(row.total_cost),
        requestCount: parseInt(row.request_count),
        avgCostPerRequest: parseFloat(row.avg_cost_per_request),
      }));
    } catch (error) {
      logger.error('Failed to get LLM cost breakdown', error);
      throw error;
    }
  }

  private parseTimeRange(timeRange: string): string {
    // Convert shorthand to PostgreSQL interval format
    const timeMap: { [key: string]: string } = {
      '1h': '1 hour',
      '6h': '6 hours',
      '12h': '12 hours',
      '24h': '1 day',
      '7d': '7 days',
      '30d': '30 days',
    };

    return timeMap[timeRange] || '1 hour';
  }

  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }
}
