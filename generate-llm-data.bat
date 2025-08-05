@echo off
REM LLM Metrics Data Generation Script - Windows Batch
REM Generates sample LLM performance data for dashboard visualization

echo 🤖 LLM Metrics Data Generation Script
echo =====================================

REM Check if Docker is running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if LLM service is running
echo 🔍 Checking LLM Metrics Service status...
docker ps --format "{{.Names}}" | findstr "llm-metrics-service" >nul
if %errorlevel% neq 0 (
    echo ❌ LLM Metrics Service is not running. Please start services first:
    echo    docker-compose up -d
    pause
    exit /b 1
)

REM Test service connectivity
echo 🌐 Testing LLM service connectivity...
curl -s http://localhost:8090/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Cannot connect to LLM service at http://localhost:8090
    echo    Make sure the service is running and accessible.
    pause
    exit /b 1
)

echo ✅ LLM Metrics Service is running and accessible

REM Get user input for number of records
set /p BATCH_SIZE="📊 Enter number of LLM metrics to generate (default: 25): "
if "%BATCH_SIZE%"=="" set BATCH_SIZE=25

REM Validate input is numeric
echo %BATCH_SIZE%| findstr /r "^[0-9][0-9]*$" >nul
if %errorlevel% neq 0 (
    echo ❌ Invalid input. Using default value of 25.
    set BATCH_SIZE=25
)

echo.
echo 🚀 Generating %BATCH_SIZE% LLM performance metrics...
echo    This may take a few moments...
echo.

REM Generate LLM metrics data
curl -X POST http://localhost:8090/api/demo/generate-metrics ^
  -H "Content-Type: application/json" ^
  -d "{\"count\": %BATCH_SIZE%}" ^
  -w "%%{http_code}" ^
  -o temp_response.json ^
  -s

set HTTP_CODE=%errorlevel%

REM Check if request was successful
if exist temp_response.json (
    findstr "Generated.*demo metrics" temp_response.json >nul
    if %errorlevel% equ 0 (
        echo ✅ Successfully generated %BATCH_SIZE% LLM metrics!
    ) else (
        echo ❌ Error generating LLM metrics. Response:
        type temp_response.json
    )
    del temp_response.json
) else (
    echo ❌ Failed to connect to LLM service
)

echo.
echo 📊 Verifying data generation...

REM Query database to verify data
docker exec -it timescaledb psql -U prometheus -d metrics -c "SELECT COUNT(*) as total_llm_records FROM metrics.llm_metrics;" 2>nul | findstr -C:"total_llm_records"

echo.
echo 📈 LLM Metrics Summary (last hour):
docker exec -it timescaledb psql -U prometheus -d metrics -c "SELECT model, COUNT(*) as requests, ROUND(AVG(cost_usd)::numeric, 6) as avg_cost, ROUND(AVG(total_duration)::numeric, 2) as avg_duration FROM metrics.llm_metrics WHERE time > NOW() - INTERVAL '1 hour' GROUP BY model ORDER BY requests DESC;" 2>nul

echo.
echo 🎯 Next Steps:
echo    1. Open Grafana: http://localhost:3090
echo    2. Navigate to LLM Performance Dashboard
echo    3. Refresh panels to see new data
echo    4. Run this script again to generate more data
echo.
echo 🔗 Additional Commands:
echo    - View LLM service logs: docker logs llm-metrics-service --tail 20
echo    - Check service health: curl http://localhost:8090/health
echo    - Generate more data: curl -X POST http://localhost:8090/api/demo/generate-metrics -H "Content-Type: application/json" -d "{\"count\": 50}"
echo.

REM Ask if user wants to generate another batch
set /p GENERATE_MORE="🔄 Generate another batch? (y/n): "
if /i "%GENERATE_MORE%"=="y" (
    echo.
    goto :batch_generation
)

echo 🎉 LLM data generation complete!
pause
exit /b 0

:batch_generation
set /p BATCH_SIZE="📊 Enter number of additional LLM metrics (default: 15): "
if "%BATCH_SIZE%"=="" set BATCH_SIZE=15

echo.
echo 🚀 Generating additional %BATCH_SIZE% LLM metrics...

curl -X POST http://localhost:8090/api/demo/generate-metrics ^
  -H "Content-Type: application/json" ^
  -d "{\"count\": %BATCH_SIZE%}" ^
  -s >nul

if %errorlevel% equ 0 (
    echo ✅ Successfully generated additional %BATCH_SIZE% LLM metrics!
) else (
    echo ❌ Error generating additional LLM metrics
)

echo 🎉 All data generation complete!
pause
