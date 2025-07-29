@echo off
REM Enterprise Metrics Collection POC - Windows Start Script

echo 🚀 Starting Enterprise Metrics Collection POC...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

REM Create necessary directories
echo 📁 Creating directories...
if not exist "logs" mkdir logs
if not exist "data" mkdir data
if not exist "data\prometheus" mkdir data\prometheus
if not exist "data\grafana" mkdir data\grafana
if not exist "data\timescaledb" mkdir data\timescaledb
if not exist "data\rabbitmq" mkdir data\rabbitmq

REM Set environment variables if not set
if "%OPENAI_API_KEY%"=="" set OPENAI_API_KEY=demo_key

echo 🔧 Environment Configuration:
echo   - OpenAI API Key: %OPENAI_API_KEY:~0,10%...
for /f "tokens=*" %%i in ('docker --version') do echo   - Docker Version: %%i
for /f "tokens=*" %%i in ('docker-compose --version') do echo   - Docker Compose Version: %%i

REM Pull latest images
echo 📥 Pulling Docker images...
docker-compose pull

REM Build custom services
echo 🔨 Building custom services...
docker-compose build

REM Start services
echo 🌟 Starting all services...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 30 /nobreak >nul

echo 🏥 Checking service health...
echo   ⚠️  Services may take a moment to be fully ready during first startup

echo.
echo 🎉 POC Started Successfully!
echo.
echo 📊 Access Points:
echo   - Grafana Dashboard: http://localhost:3090 (admin/admin)
echo   - Prometheus: http://localhost:9090
echo   - RabbitMQ Management: http://localhost:15672 (guest/guest)
echo   - LLM Metrics API: http://localhost:8080
echo.
echo 🔍 Health Checks:
echo   - LLM Service Health: http://localhost:8080/health
echo   - Prometheus Metrics: http://localhost:9090/metrics
echo.
echo 🧪 Demo Commands (use PowerShell or CMD):
echo   - Generate LLM metrics:
echo     curl -X POST http://localhost:8080/api/demo/generate-metrics -H "Content-Type: application/json" -d "{\"count\": 20}"
echo   - Query LLM summary:
echo     curl http://localhost:8080/api/metrics/llm/summary?timeRange=1h
echo.
echo 📚 Next Steps:
echo   1. Open Grafana at http://localhost:3000
echo   2. Login with admin/admin
echo   3. Navigate to Dashboards to view RabbitMQ and LLM metrics
echo   4. Generate sample data using the demo endpoints
echo   5. Monitor real-time metrics and alerts
echo.
echo 🛑 To stop: docker-compose down
echo 🗑️  To clean up: docker-compose down -v
echo.
pause
