@echo off
echo 🔧 Installing dependencies for LLM Metrics Service...

cd llm-metrics-service

if not exist package.json (
    echo ❌ package.json not found. Please ensure you're in the correct directory.
    pause
    exit /b 1
)

echo 📦 Installing Node.js dependencies...
call npm install

echo 🔨 Building TypeScript...
call npm run build

echo ✅ LLM Metrics Service dependencies installed successfully!

cd ..

echo 🔧 Installing dependencies for RabbitMQ Demo...

cd rabbitmq-demo

if not exist package.json (
    echo ❌ package.json not found for RabbitMQ demo.
    pause
    exit /b 1
)

echo 📦 Installing Node.js dependencies...
call npm install

echo 🔨 Building TypeScript...
call npm run build

echo ✅ RabbitMQ Demo dependencies installed successfully!

cd ..

echo 🎉 All dependencies installed successfully!
echo.
echo Next steps:
echo 1. Set environment variables (copy .env.example to .env)
echo 2. Run: docker-compose up -d
echo 3. Test endpoints and dashboards
pause
