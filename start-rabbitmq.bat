@echo off
echo Starting RabbitMQ Service...
echo.

REM Check if RabbitMQ container is already running
docker ps -q -f name=rabbitmq >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo RabbitMQ container is already running. Restarting...
    docker restart rabbitmq
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to restart RabbitMQ container!
        pause
        exit /b 1
    )
) else (
    echo RabbitMQ container not running. Starting...
    docker-compose up -d rabbitmq
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to start RabbitMQ container!
        pause
        exit /b 1
    )
)

echo.
echo RabbitMQ Service Started Successfully!
echo.
echo RabbitMQ Management UI: http://localhost:15672
echo Default credentials: guest/guest
echo.
echo Press any key to exit...
pause >nul
