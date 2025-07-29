import { Counter, Histogram, Gauge, register } from 'prom-client';

export interface LLMMetrics {
  requestId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timeToFirstToken: number;
  tokensPerSecond: number;
  totalDuration: number;
  costUsd: number;
  status: 'success' | 'error';
  errorMessage?: string;
  userId: string;
  endpoint: string;
}

export class LLMMetricsCollector {
  private requestsTotal: Counter<string>;
  private responseTime: Histogram<string>;
  private timeToFirstToken: Histogram<string>;
  private tokensPerSecond: Histogram<string>;
  private totalTokens: Histogram<string>;
  private costTotal: Counter<string>;
  private activeRequests: Gauge<string>;

  constructor() {
    // Initialize Prometheus metrics
    this.requestsTotal = new Counter({
      name: 'llm_requests_total',
      help: 'Total number of LLM requests',
      labelNames: ['model', 'status', 'user_id', 'endpoint'],
      registers: [register],
    });

    this.responseTime = new Histogram({
      name: 'llm_response_time_seconds',
      help: 'LLM response time in seconds',
      labelNames: ['model', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [register],
    });

    this.timeToFirstToken = new Histogram({
      name: 'llm_time_to_first_token_seconds',
      help: 'Time to first token in seconds',
      labelNames: ['model', 'endpoint'],
      buckets: [0.1, 0.2, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.tokensPerSecond = new Histogram({
      name: 'llm_tokens_per_second',
      help: 'Token generation speed (tokens/second)',
      labelNames: ['model', 'endpoint'],
      buckets: [1, 5, 10, 20, 50, 100, 200],
      registers: [register],
    });

    this.totalTokens = new Histogram({
      name: 'llm_total_tokens',
      help: 'Total tokens per request',
      labelNames: ['model', 'endpoint'],
      buckets: [10, 50, 100, 500, 1000, 2000, 4000, 8000],
      registers: [register],
    });

    this.costTotal = new Counter({
      name: 'llm_cost_usd_total',
      help: 'Total cost in USD',
      labelNames: ['model', 'endpoint'],
      registers: [register],
    });

    this.activeRequests = new Gauge({
      name: 'llm_active_requests',
      help: 'Number of active LLM requests',
      labelNames: ['model', 'endpoint'],
      registers: [register],
    });
  }

  public recordMetrics(metrics: LLMMetrics): void {
    const labels = {
      model: metrics.model,
      endpoint: metrics.endpoint,
    };

    const requestLabels = {
      ...labels,
      status: metrics.status,
      user_id: metrics.userId,
    };

    // Record request count
    this.requestsTotal.inc(requestLabels);

    // Record timing metrics (only for successful requests)
    if (metrics.status === 'success') {
      this.responseTime.observe(labels, metrics.totalDuration);
      this.timeToFirstToken.observe(labels, metrics.timeToFirstToken);
      this.tokensPerSecond.observe(labels, metrics.tokensPerSecond);
      this.totalTokens.observe(labels, metrics.totalTokens);
      this.costTotal.inc(labels, metrics.costUsd);
    }
  }

  public incrementActiveRequests(model: string, endpoint: string): void {
    this.activeRequests.inc({ model, endpoint });
  }

  public decrementActiveRequests(model: string, endpoint: string): void {
    this.activeRequests.dec({ model, endpoint });
  }

  public getMetrics(): Promise<string> {
    return register.metrics();
  }
}
