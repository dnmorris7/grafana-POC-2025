# API Documentation

## LLM Metrics Service API

### Base URL
```
http://localhost:8080
```

### Authentication
Currently using API key authentication (configurable via environment variables).

## Endpoints

### Health Check
Check the health status of the metrics service.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T10:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Prometheus Metrics
Retrieve Prometheus-formatted metrics for scraping.

**Request:**
```http
GET /metrics
```

**Response:**
```
# HELP llm_requests_total Total number of LLM requests
# TYPE llm_requests_total counter
llm_requests_total{model="gpt-3.5-turbo",status="success",user_id="user123",endpoint="/api/llm/chat"} 42

# HELP llm_response_time_seconds LLM response time in seconds
# TYPE llm_response_time_seconds histogram
llm_response_time_seconds_bucket{model="gpt-3.5-turbo",endpoint="/api/llm/chat",le="0.1"} 0
llm_response_time_seconds_bucket{model="gpt-3.5-turbo",endpoint="/api/llm/chat",le="0.5"} 5
...
```

### LLM Chat Completion
Generate an LLM completion and record performance metrics.

**Request:**
```http
POST /api/llm/chat
Content-Type: application/json

{
  "prompt": "Explain quantum computing in simple terms",
  "model": "gpt-3.5-turbo",
  "userId": "user123",
  "maxTokens": 1000,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Quantum computing is a revolutionary computing paradigm...",
  "metrics": {
    "promptTokens": 12,
    "completionTokens": 150,
    "totalTokens": 162,
    "timeToFirstToken": 0.45,
    "tokensPerSecond": 85.5,
    "totalDuration": 2.1,
    "cost": 0.000324
  },
  "model": "gpt-3.5-turbo",
  "status": "success"
}
```

### LLM Metrics Summary
Get aggregated metrics summary for a specified time range.

**Request:**
```http
GET /api/metrics/llm/summary?timeRange=1h&model=gpt-3.5-turbo
```

**Response:**
```json
{
  "totalRequests": 125,
  "successRate": 0.984,
  "avgTimeToFirstToken": 0.52,
  "avgTokensPerSecond": 78.3,
  "avgTotalDuration": 3.2,
  "totalCost": 0.045,
  "avgTokensPerRequest": 185,
  "errorCount": 2
}
```

### LLM Cost Breakdown
Get cost breakdown by time periods and models.

**Request:**
```http
GET /api/metrics/llm/costs?timeRange=24h&groupBy=hour
```

**Response:**
```json
[
  {
    "timestamp": "2025-01-26T10:00:00.000Z",
    "model": "gpt-3.5-turbo",
    "totalCost": 0.12,
    "requestCount": 45,
    "avgCostPerRequest": 0.0027
  },
  {
    "timestamp": "2025-01-26T10:00:00.000Z",
    "model": "gpt-4",
    "totalCost": 0.89,
    "requestCount": 12,
    "avgCostPerRequest": 0.074
  }
]
```

### Generate Demo Metrics
Generate sample LLM interactions for testing and demonstration.

**Request:**
```http
POST /api/demo/generate-metrics
Content-Type: application/json

{
  "count": 20
}
```

**Response:**
```json
{
  "message": "Generated 20 demo metrics",
  "results": [
    {
      "requestId": "demo-1",
      "model": "gpt-3.5-turbo",
      "status": "success",
      "metrics": {
        "totalTokens": 156,
        "cost": 0.000312
      }
    }
  ]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Prompt is required"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting
- Default: 100 requests per minute per IP
- Header: `X-RateLimit-Remaining`

## Webhook Integration
Configure webhooks for real-time notifications:

```http
POST /api/webhooks/register
Content-Type: application/json

{
  "url": "https://your-service.com/webhook",
  "events": ["high_cost", "error_rate_spike"],
  "secret": "your-webhook-secret"
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Generate completion
const response = await client.post('/api/llm/chat', {
  prompt: 'What is machine learning?',
  model: 'gpt-3.5-turbo',
  userId: 'user123'
});

console.log(response.data.metrics);
```

### Python
```python
import requests

def generate_completion(prompt, model='gpt-3.5-turbo', user_id='anonymous'):
    response = requests.post('http://localhost:8080/api/llm/chat', json={
        'prompt': prompt,
        'model': model,
        'userId': user_id
    })
    return response.json()

result = generate_completion('Explain neural networks')
print(f"Cost: ${result['metrics']['cost']:.6f}")
```

### cURL Examples
```bash
# Generate completion
curl -X POST http://localhost:8080/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is AI?", "model": "gpt-3.5-turbo"}'

# Get metrics summary
curl "http://localhost:8080/api/metrics/llm/summary?timeRange=1h"

# Generate demo data
curl -X POST http://localhost:8080/api/demo/generate-metrics \
  -H "Content-Type: application/json" \
  -d '{"count": 10}'
```
