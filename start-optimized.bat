@echo off
echo Starting Optimized LLM Monitoring Stack...
echo.

REM Stop any existing containers
echo Stopping existing containers...
docker-compose down

REM Start core services first
echo Starting core infrastructure...
docker-compose up -d timescaledb redis prometheus

REM Wait for databases to be ready
echo Waiting for databases to initialize...
timeout /t 10 /nobreak >nul

REM Start application services
echo Starting application services...
docker-compose up -d llm-metrics-service rabbitmq rabbitmq-exporter

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Start monitoring and demo
echo Starting monitoring and demo services...
docker-compose up -d grafana rabbitmq-demo

REM Wait for Grafana to start
echo Waiting for Grafana to initialize...
timeout /t 10 /nobreak >nul

REM Run database optimizations
echo Applying database optimizations...
docker exec -i timescaledb psql -U prometheus -d metrics < timescaledb/optimize.sql

echo.
echo =================================
echo Optimized Stack Started Successfully!
echo =================================
echo.
echo Services Available:
echo - Grafana Dashboard: http://localhost:3090 (admin/admin)
echo - Prometheus: http://localhost:9090
echo - RabbitMQ Management: http://localhost:15672 (guest/guest)
echo - LLM Metrics API: http://localhost:8090
echo - Redis: localhost:6379
echo.
echo Health Checks:
docker-compose ps
echo.
echo Press any key to exit...
pause >nul
