export const config = {
  port: parseInt(process.env.PROMETHEUS_PORT || '8080', 10),
  database: {
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT || '5432', 10),
    database: process.env.TIMESCALE_DB || 'metrics',
    user: process.env.TIMESCALE_USER || 'prometheus',
    password: process.env.TIMESCALE_PASSWORD || 'prometheus_password',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'demo_key',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  metrics: {
    defaultLabels: {
      service: 'llm-metrics-service',
      version: process.env.npm_package_version || '1.0.0',
    },
  },
};

export default config;
