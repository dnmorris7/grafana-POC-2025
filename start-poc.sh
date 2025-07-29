#!/bin/bash

# Enterprise Metrics Collection POC - Quick Start Script

echo "🚀 Starting Enterprise Metrics Collection POC..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p data/{prometheus,grafana,timescaledb,rabbitmq}

# Set environment variables if not set
export OPENAI_API_KEY="${OPENAI_API_KEY:-demo_key}"

echo "🔧 Environment Configuration:"
echo "  - OpenAI API Key: ${OPENAI_API_KEY:0:10}..."
echo "  - Docker Version: $(docker --version)"
echo "  - Docker Compose Version: $(docker-compose --version)"

# Pull latest images
echo "📥 Pulling Docker images..."
docker-compose pull

# Build custom services
echo "🔨 Building custom services..."
docker-compose build

# Start services
echo "🌟 Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🏥 Checking service health..."

services=("timescaledb:5432" "prometheus:9090" "grafana:3000" "rabbitmq:15672" "llm-metrics-service:8080")
for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d':' -f1)
    port=$(echo $service | cut -d':' -f2)
    
    if curl -s -f "http://localhost:$port" > /dev/null 2>&1 || nc -z localhost $port > /dev/null 2>&1; then
        echo "  ✅ $service_name is ready"
    else
        echo "  ⚠️  $service_name may not be ready yet (this is normal during first startup)"
    fi
done

echo ""
echo "🎉 POC Started Successfully!"
echo ""
echo "📊 Access Points:"
echo "  - Grafana Dashboard: http://localhost:3000 (admin/admin)"
echo "  - Prometheus: http://localhost:9090"
echo "  - RabbitMQ Management: http://localhost:15672 (guest/guest)"
echo "  - LLM Metrics API: http://localhost:8080"
echo ""
echo "🔍 Health Checks:"
echo "  - LLM Service Health: http://localhost:8080/health"
echo "  - Prometheus Metrics: http://localhost:9090/metrics"
echo ""
echo "🧪 Demo Commands:"
echo "  - Generate LLM metrics: curl -X POST http://localhost:8080/api/demo/generate-metrics -H 'Content-Type: application/json' -d '{\"count\": 20}'"
echo "  - Query LLM summary: curl http://localhost:8080/api/metrics/llm/summary?timeRange=1h"
echo "  - View RabbitMQ queues: Navigate to http://localhost:15672 and login with guest/guest"
echo ""
echo "📚 Next Steps:"
echo "  1. Open Grafana at http://localhost:3000"
echo "  2. Login with admin/admin"
echo "  3. Navigate to Dashboards to view RabbitMQ and LLM metrics"
echo "  4. Generate sample data using the demo endpoints"
echo "  5. Monitor real-time metrics and alerts"
echo ""
echo "🛑 To stop: docker-compose down"
echo "🗑️  To clean up: docker-compose down -v"
