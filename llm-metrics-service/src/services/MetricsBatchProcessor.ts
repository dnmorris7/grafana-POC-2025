import { LLMMetrics } from '../metrics/LLMMetricsCollector';
import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export class MetricsBatchProcessor {
  private metricsBuffer: LLMMetrics[] = [];
  private batchSize: number = 100;
  private flushInterval: number = 5000; // 5 seconds
  private lastFlush: number = Date.now();
  private flushTimer: NodeJS.Timeout | null = null;
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService, batchSize: number = 100) {
    this.databaseService = databaseService;
    this.batchSize = batchSize;
    this.startFlushTimer();
  }

  public addMetrics(metrics: LLMMetrics): void {
    this.metricsBuffer.push(metrics);
    
    if (this.metricsBuffer.length >= this.batchSize) {
      this.flushMetrics();
    }
  }

  public async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const batch = [...this.metricsBuffer];
    this.metricsBuffer = [];
    this.lastFlush = Date.now();

    try {
      await this.databaseService.saveLLMMetricsBatch(batch);
      logger.info('Metrics batch flushed successfully', { 
        batchSize: batch.length,
        bufferRemaining: this.metricsBuffer.length 
      });
    } catch (error) {
      logger.error('Failed to flush metrics batch', error);
      // Re-add failed metrics to buffer for retry
      this.metricsBuffer.unshift(...batch);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      const timeSinceLastFlush = Date.now() - this.lastFlush;
      if (timeSinceLastFlush >= this.flushInterval && this.metricsBuffer.length > 0) {
        this.flushMetrics();
      }
    }, 1000); // Check every second
  }

  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush any remaining metrics
    await this.flushMetrics();
    logger.info('MetricsBatchProcessor shutdown complete');
  }

  public getBufferStatus(): { size: number; lastFlush: number } {
    return {
      size: this.metricsBuffer.length,
      lastFlush: this.lastFlush
    };
  }
}
