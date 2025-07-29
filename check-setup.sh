#!/bin/bash

echo "🔍 Enterprise Metrics Collection POC - Pre-Test Validation"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
        ((WARNINGS++))
    else
        echo -e "${RED}❌ $message${NC}"
        ((ERRORS++))
    fi
}

echo ""
echo "🐋 Docker Environment Check"
echo "============================"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_status "OK" "Docker installed: $DOCKER_VERSION"
else
    print_status "ERROR" "Docker is not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_status "OK" "Docker Compose installed: $COMPOSE_VERSION"
else
    print_status "ERROR" "Docker Compose is not installed"
fi

# Check Docker daemon
if docker info &> /dev/null; then
    print_status "OK" "Docker daemon is running"
else
    print_status "ERROR" "Docker daemon is not running"
fi

echo ""
echo "📁 File Structure Check"
echo "======================="

# Check main files
FILES=(
    "docker-compose.yml"
    "prometheus/prometheus.yml"
    "grafana/provisioning/datasources/datasources.yml"
    "grafana/dashboards/rabbitmq-dashboard.json"
    "grafana/dashboards/llm-dashboard.json"
    "timescaledb/init.sql"
    "llm-metrics-service/package.json"
    "llm-metrics-service/Dockerfile"
    "rabbitmq-demo/package.json"
    "rabbitmq/enabled_plugins"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status "OK" "Found: $file"
    else
        print_status "ERROR" "Missing: $file"
    fi
done

echo ""
echo "📦 Node.js Dependencies Check"
echo "============================="

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "OK" "Node.js installed: $NODE_VERSION"
else
    print_status "WARNING" "Node.js not found (needed for local development)"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "OK" "npm installed: $NPM_VERSION"
else
    print_status "WARNING" "npm not found (needed for local development)"
fi

# Check LLM service dependencies
if [ -d "llm-metrics-service/node_modules" ]; then
    print_status "OK" "LLM service dependencies installed"
else
    print_status "WARNING" "LLM service dependencies not installed (run install-deps.sh)"
fi

# Check RabbitMQ demo dependencies
if [ -d "rabbitmq-demo/node_modules" ]; then
    print_status "OK" "RabbitMQ demo dependencies installed"
else
    print_status "WARNING" "RabbitMQ demo dependencies not installed (run install-deps.sh)"
fi

echo ""
echo "🔧 Configuration Check"
echo "======================"

# Check environment file
if [ -f ".env" ]; then
    print_status "OK" "Environment file (.env) exists"
else
    if [ -f ".env.example" ]; then
        print_status "WARNING" "No .env file found, but .env.example exists (copy it to .env)"
    else
        print_status "ERROR" ".env.example file missing"
    fi
fi

# Check port availability
PORTS=(3000 5432 5672 8080 9090 15672)
echo ""
echo "🔌 Port Availability Check"
echo "=========================="

for port in "${PORTS[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        print_status "WARNING" "Port $port is already in use"
    else
        print_status "OK" "Port $port is available"
    fi
done

echo ""
echo "🔍 Syntax Check"
echo "==============="

# Check docker-compose syntax
if docker-compose config &> /dev/null; then
    print_status "OK" "docker-compose.yml syntax is valid"
else
    print_status "ERROR" "docker-compose.yml has syntax errors"
fi

# Check JSON files
JSON_FILES=(
    "grafana/dashboards/rabbitmq-dashboard.json"
    "grafana/dashboards/llm-dashboard.json"
    "grafana/provisioning/datasources/datasources.yml"
)

for json_file in "${JSON_FILES[@]}"; do
    if [ -f "$json_file" ]; then
        if python3 -m json.tool "$json_file" &> /dev/null 2>&1 || jq empty "$json_file" &> /dev/null 2>&1; then
            print_status "OK" "$json_file syntax is valid"
        else
            print_status "WARNING" "$json_file might have syntax issues (JSON validator not available)"
        fi
    fi
done

echo ""
echo "🧪 TypeScript Build Check"
echo "========================="

# Check TypeScript builds
if [ -d "llm-metrics-service" ]; then
    cd llm-metrics-service
    if [ -f "dist/index.js" ]; then
        print_status "OK" "LLM service TypeScript build exists"
    else
        print_status "WARNING" "LLM service not built (run npm run build)"
    fi
    cd ..
fi

if [ -d "rabbitmq-demo" ]; then
    cd rabbitmq-demo
    if [ -f "dist/index.js" ]; then
        print_status "OK" "RabbitMQ demo TypeScript build exists"
    else
        print_status "WARNING" "RabbitMQ demo not built (run npm run build)"
    fi
    cd ..
fi

echo ""
echo "📊 Summary"
echo "=========="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! You're ready to start testing.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. docker-compose up -d"
    echo "2. ./demo.sh"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found, but no critical errors.${NC}"
    echo "You can proceed with testing, but consider addressing the warnings."
    echo ""
    echo "Quick fixes:"
    echo "1. Run: ./install-deps.sh (to install dependencies)"
    echo "2. Copy: cp .env.example .env (to create environment file)"
    echo "3. docker-compose up -d"
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo "Please fix the errors before proceeding with testing."
    echo ""
    echo "Common fixes:"
    echo "1. Install Docker and Docker Compose"
    echo "2. Start Docker daemon"
    echo "3. Run: ./install-deps.sh"
    echo "4. Fix any syntax errors in configuration files"
fi

echo ""
echo -e "${BLUE}💡 Helpful Commands:${NC}"
echo "  Install dependencies: ./install-deps.sh"
echo "  Start services: docker-compose up -d"
echo "  View logs: docker-compose logs -f [service-name]"
echo "  Stop services: docker-compose down"
echo "  Run demo: ./demo.sh"

exit $ERRORS
