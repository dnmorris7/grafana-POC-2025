#!/bin/bash

echo "🧪 Running POC Demonstration..."

# Base URL
BASE_URL="http://localhost:8080"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if service is available
check_service() {
    local service_name=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo -e "${BLUE}Checking $service_name availability...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready${NC}"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts - waiting for $service_name..."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name is not available after $max_attempts attempts${NC}"
    return 1
}

# Check all services
echo "🔍 Checking service availability..."
check_service "LLM Metrics Service" "$BASE_URL/health"
check_service "Prometheus" "http://localhost:9090/-/healthy"
check_service "Grafana" "http://localhost:3000/api/health"
check_service "RabbitMQ" "http://localhost:15672"

echo ""
echo "🎯 Demonstration Scenarios"
echo "=========================="

# Scenario 1: Generate LLM Metrics
echo ""
echo -e "${BLUE}Scenario 1: Generating LLM Performance Metrics${NC}"
echo "Simulating 20 LLM requests with different models..."

curl -s -X POST "$BASE_URL/api/demo/generate-metrics" \
    -H "Content-Type: application/json" \
    -d '{"count": 20}' | jq .

echo ""
echo "✅ LLM metrics generated successfully"

# Scenario 2: Query Metrics Summary
echo ""
echo -e "${BLUE}Scenario 2: Querying Metrics Summary${NC}"
echo "Retrieving performance summary for the last hour..."

SUMMARY=$(curl -s "$BASE_URL/api/metrics/llm/summary?timeRange=1h")
echo "$SUMMARY" | jq .

# Extract key metrics for display
TOTAL_REQUESTS=$(echo "$SUMMARY" | jq -r '.totalRequests')
SUCCESS_RATE=$(echo "$SUMMARY" | jq -r '.successRate')
TOTAL_COST=$(echo "$SUMMARY" | jq -r '.totalCost')

echo ""
echo -e "${GREEN}📊 Key Metrics:${NC}"
echo "  • Total Requests: $TOTAL_REQUESTS"
echo "  • Success Rate: $(echo "$SUCCESS_RATE * 100" | bc -l | cut -c1-5)%"
echo "  • Total Cost: \$$TOTAL_COST"

# Scenario 3: Cost Breakdown
echo ""
echo -e "${BLUE}Scenario 3: Cost Analysis${NC}"
echo "Analyzing costs by model and time period..."

COSTS=$(curl -s "$BASE_URL/api/metrics/llm/costs?timeRange=1h&groupBy=hour")
echo "$COSTS" | jq .

# Scenario 4: Individual LLM Request
echo ""
echo -e "${BLUE}Scenario 4: Individual LLM Request with Metrics${NC}"
echo "Making a sample LLM request and capturing detailed metrics..."

LLM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/llm/chat" \
    -H "Content-Type: application/json" \
    -d '{
        "prompt": "Explain the benefits of monitoring LLM performance in production systems",
        "model": "gpt-4",
        "userId": "demo-user"
    }')

echo "$LLM_RESPONSE" | jq .

# Extract specific metrics
TTFT=$(echo "$LLM_RESPONSE" | jq -r '.metrics.timeToFirstToken')
TPS=$(echo "$LLM_RESPONSE" | jq -r '.metrics.tokensPerSecond')
COST=$(echo "$LLM_RESPONSE" | jq -r '.metrics.cost')

echo ""
echo -e "${GREEN}🎯 Performance Metrics:${NC}"
echo "  • Time to First Token: ${TTFT}s"
echo "  • Tokens per Second: ${TPS}"
echo "  • Request Cost: \$$COST"

# Scenario 5: Prometheus Metrics
echo ""
echo -e "${BLUE}Scenario 5: Prometheus Metrics Sample${NC}"
echo "Fetching Prometheus-formatted metrics..."

PROMETHEUS_METRICS=$(curl -s "$BASE_URL/metrics")
echo "Sample metrics (first 10 lines):"
echo "$PROMETHEUS_METRICS" | head -10

# Count total metrics
METRIC_COUNT=$(echo "$PROMETHEUS_METRICS" | grep -c "^[a-z]")
echo ""
echo -e "${GREEN}📈 Prometheus Integration:${NC}"
echo "  • Total metrics exposed: $METRIC_COUNT"
echo "  • Metrics endpoint: $BASE_URL/metrics"

echo ""
echo "🎉 Demonstration Complete!"
echo ""
echo -e "${BLUE}🔗 Next Steps:${NC}"
echo "1. Open Grafana: http://localhost:3000 (admin/admin)"
echo "2. Navigate to Dashboards → Browse"
echo "3. View 'RabbitMQ Performance Dashboard'"
echo "4. View 'LLM Performance Dashboard'"
echo "5. Check RabbitMQ Management: http://localhost:15672 (guest/guest)"
echo ""
echo -e "${BLUE}💡 Pro Tips:${NC}"
echo "• Refresh dashboards to see real-time data"
echo "• Generate more metrics using: curl -X POST $BASE_URL/api/demo/generate-metrics -d '{\"count\": 50}'"
echo "• Monitor RabbitMQ queues for message flow patterns"
echo "• Set up alerts based on cost thresholds or performance degradation"
echo ""
echo -e "${GREEN}✨ Enjoy exploring your enterprise metrics collection solution!${NC}"
