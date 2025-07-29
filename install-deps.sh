#!/bin/bash

echo "🔧 Installing dependencies for LLM Metrics Service..."

cd llm-metrics-service

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please ensure you're in the correct directory."
    exit 1
fi

echo "📦 Installing Node.js dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

echo "✅ LLM Metrics Service dependencies installed successfully!"

cd ..

echo "🔧 Installing dependencies for RabbitMQ Demo..."

cd rabbitmq-demo

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found for RabbitMQ demo."
    exit 1
fi

echo "📦 Installing Node.js dependencies..."
npm install

echo "🔨 Building TypeScript..."
npm run build

echo "✅ RabbitMQ Demo dependencies installed successfully!"

cd ..

echo "🎉 All dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Set environment variables (copy .env.example to .env)"
echo "2. Run: docker-compose up -d"
echo "3. Test endpoints and dashboards"
