@echo off
echo 🔍 Enterprise Metrics Collection POC - Pre-Test Validation
echo ==========================================================

set ERRORS=0
set WARNINGS=0

echo.
echo 🐋 Docker Environment Check
echo ============================

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker --version') do echo ✅ Docker installed: %%i
) else (
    echo ❌ Docker is not installed
    set /a ERRORS+=1
)

REM Check Docker Compose
docker-compose --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker-compose --version') do echo ✅ Docker Compose installed: %%i
) else (
    echo ❌ Docker Compose is not installed
    set /a ERRORS+=1
)

REM Check Docker daemon
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Docker daemon is running
) else (
    echo ❌ Docker daemon is not running
    set /a ERRORS+=1
)

echo.
echo 📁 File Structure Check
echo =======================

REM Check main files
set FILES=docker-compose.yml prometheus\prometheus.yml grafana\provisioning\datasources\datasources.yml
for %%f in (%FILES%) do (
    if exist "%%f" (
        echo ✅ Found: %%f
    ) else (
        echo ❌ Missing: %%f
        set /a ERRORS+=1
    )
)

echo.
echo 📦 Node.js Dependencies Check
echo =============================

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js installed: %%i
) else (
    echo ⚠️  Node.js not found (needed for local development)
    set /a WARNINGS+=1
)

REM Check npm
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do echo ✅ npm installed: %%i
) else (
    echo ⚠️  npm not found (needed for local development)
    set /a WARNINGS+=1
)

REM Check dependencies
if exist "llm-metrics-service\node_modules" (
    echo ✅ LLM service dependencies installed
) else (
    echo ⚠️  LLM service dependencies not installed (run install-deps.bat)
    set /a WARNINGS+=1
)

if exist "rabbitmq-demo\node_modules" (
    echo ✅ RabbitMQ demo dependencies installed
) else (
    echo ⚠️  RabbitMQ demo dependencies not installed (run install-deps.bat)
    set /a WARNINGS+=1
)

echo.
echo 🔧 Configuration Check
echo ======================

if exist ".env" (
    echo ✅ Environment file (.env) exists
) else (
    if exist ".env.example" (
        echo ⚠️  No .env file found, but .env.example exists (copy it to .env)
        set /a WARNINGS+=1
    ) else (
        echo ❌ .env.example file missing
        set /a ERRORS+=1
    )
)

echo.
echo 🔍 Syntax Check
echo ===============

docker-compose config >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ docker-compose.yml syntax is valid
) else (
    echo ❌ docker-compose.yml has syntax errors
    set /a ERRORS+=1
)

echo.
echo 🧪 TypeScript Build Check
echo =========================

if exist "llm-metrics-service\dist\index.js" (
    echo ✅ LLM service TypeScript build exists
) else (
    echo ⚠️  LLM service not built (run npm run build)
    set /a WARNINGS+=1
)

if exist "rabbitmq-demo\dist\index.js" (
    echo ✅ RabbitMQ demo TypeScript build exists
) else (
    echo ⚠️  RabbitMQ demo not built (run npm run build)
    set /a WARNINGS+=1
)

echo.
echo 📊 Summary
echo ==========

if %ERRORS% equ 0 if %WARNINGS% equ 0 (
    echo 🎉 All checks passed! You're ready to start testing.
    echo.
    echo Next steps:
    echo 1. docker-compose up -d
    echo 2. demo.sh
) else if %ERRORS% equ 0 (
    echo ⚠️  %WARNINGS% warning(s) found, but no critical errors.
    echo You can proceed with testing, but consider addressing the warnings.
    echo.
    echo Quick fixes:
    echo 1. Run: install-deps.bat (to install dependencies)
    echo 2. Copy: copy .env.example .env (to create environment file)
    echo 3. docker-compose up -d
) else (
    echo ❌ %ERRORS% error(s) and %WARNINGS% warning(s) found.
    echo Please fix the errors before proceeding with testing.
    echo.
    echo Common fixes:
    echo 1. Install Docker and Docker Compose
    echo 2. Start Docker daemon
    echo 3. Run: install-deps.bat
    echo 4. Fix any syntax errors in configuration files
)

echo.
echo 💡 Helpful Commands:
echo   Install dependencies: install-deps.bat
echo   Start services: docker-compose up -d
echo   View logs: docker-compose logs -f [service-name]
echo   Stop services: docker-compose down
echo   Check health: curl http://localhost:8080/health

pause
