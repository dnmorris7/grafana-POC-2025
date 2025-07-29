export const config = {
  port: parseInt(process.env.PROMETHEUS_PORT || '8080'),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT || '5432'),
    database: process.env.TIMESCALE_DB || 'metrics',
    user: process.env.TIMESCALE_USER || 'prometheus',
    password: process.env.TIMESCALE_PASSWORD || 'prometheus_password',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'demo_key',
  },
  metrics: {
    defaultTimeout: 30000, // 30 seconds
    maxRetries: 3,
  },
};
