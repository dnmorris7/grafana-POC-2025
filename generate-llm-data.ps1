# LLM Metrics Data Generation Script - PowerShell
# Generates sample LLM performance data for dashboard visualization

Write-Host "🤖 LLM Metrics Data Generation Script" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if Docker is running
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not found"
    }
    Write-Host "✅ Docker is running: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if LLM service is running
Write-Host "🔍 Checking LLM Metrics Service status..." -ForegroundColor Yellow
$llmService = docker ps --format "{{.Names}}" | Select-String "llm-metrics-service"
if (-not $llmService) {
    Write-Host "❌ LLM Metrics Service is not running. Please start services first:" -ForegroundColor Red
    Write-Host "   docker-compose up -d" -ForegroundColor Cyan
    Read-Host "Press Enter to exit"
    exit 1
}

# Test service connectivity
Write-Host "🌐 Testing LLM service connectivity..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:8090/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ LLM Metrics Service is running and accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Cannot connect to LLM service at http://localhost:8090" -ForegroundColor Red
    Write-Host "   Make sure the service is running and accessible." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Get user input for batch size
$batchSize = Read-Host "📊 Enter number of LLM metrics to generate (default: 25)"
if ([string]::IsNullOrEmpty($batchSize) -or $batchSize -notmatch '^\d+$') {
    $batchSize = 25
    Write-Host "Using default batch size: $batchSize" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Generating $batchSize LLM performance metrics..." -ForegroundColor Green
Write-Host "   This may take a few moments..." -ForegroundColor Yellow
Write-Host ""

# Generate LLM metrics data
try {
    $body = @{ count = [int]$batchSize } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:8090/api/demo/generate-metrics" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 60
    
    Write-Host "✅ Successfully generated $batchSize LLM metrics!" -ForegroundColor Green
    Write-Host "📄 Response: $($response.message)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error generating LLM metrics: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "📊 Verifying data generation..." -ForegroundColor Yellow

# Query database to verify data
try {
    $totalRecords = docker exec -it timescaledb psql -U prometheus -d metrics -c "SELECT COUNT(*) as total_llm_records FROM metrics.llm_metrics;" 2>$null
    Write-Host "Total LLM records in database:" -ForegroundColor Cyan
    Write-Host $totalRecords -ForegroundColor White
} catch {
    Write-Host "⚠️  Could not verify database records" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📈 LLM Metrics Summary (last hour):" -ForegroundColor Yellow
try {
    $summary = docker exec -it timescaledb psql -U prometheus -d metrics -c "SELECT model, COUNT(*) as requests, ROUND(AVG(cost_usd)::numeric, 6) as avg_cost, ROUND(AVG(total_duration)::numeric, 2) as avg_duration FROM metrics.llm_metrics WHERE time > NOW() - INTERVAL '1 hour' GROUP BY model ORDER BY requests DESC;" 2>$null
    Write-Host $summary -ForegroundColor White
} catch {
    Write-Host "⚠️  Could not retrieve metrics summary" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Green
Write-Host "   1. Open Grafana: http://localhost:3090" -ForegroundColor Cyan
Write-Host "   2. Navigate to LLM Performance Dashboard" -ForegroundColor Cyan
Write-Host "   3. Refresh panels to see new data" -ForegroundColor Cyan
Write-Host "   4. Run this script again to generate more data" -ForegroundColor Cyan

Write-Host ""
Write-Host "🔗 Additional Commands:" -ForegroundColor Green
Write-Host "   - View service logs: docker logs llm-metrics-service --tail 20" -ForegroundColor Cyan
Write-Host "   - Check health: curl http://localhost:8090/health" -ForegroundColor Cyan
Write-Host "   - Service endpoints: http://localhost:8090/api/llm/health" -ForegroundColor Cyan

Write-Host ""
# Ask if user wants to generate another batch
$generateMore = Read-Host "🔄 Generate another batch? (y/n)"
if ($generateMore -eq 'y' -or $generateMore -eq 'Y') {
    $additionalBatch = Read-Host "📊 Enter number of additional LLM metrics (default: 15)"
    if ([string]::IsNullOrEmpty($additionalBatch) -or $additionalBatch -notmatch '^\d+$') {
        $additionalBatch = 15
    }
    
    Write-Host ""
    Write-Host "🚀 Generating additional $additionalBatch LLM metrics..." -ForegroundColor Green
    
    try {
        $additionalBody = @{ count = [int]$additionalBatch } | ConvertTo-Json
        $additionalResponse = Invoke-RestMethod -Uri "http://localhost:8090/api/demo/generate-metrics" `
            -Method POST `
            -ContentType "application/json" `
            -Body $additionalBody `
            -TimeoutSec 60
        
        Write-Host "✅ Successfully generated additional $additionalBatch LLM metrics!" -ForegroundColor Green
        Write-Host "📄 Response: $($additionalResponse.message)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Error generating additional LLM metrics: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 LLM data generation complete!" -ForegroundColor Green
Read-Host "Press Enter to exit"
