# Grafana Configuration Script for Twitter Dashboard
Write-Host "Configuring Grafana TimescaleDB data source..." -ForegroundColor Green

# Wait for Grafana to be ready
do {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3090/api/health" -Method GET -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "Grafana is ready!" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "Waiting for Grafana to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
} while ($true)

# Configure TimescaleDB data source
Write-Host "Adding TimescaleDB data source..." -ForegroundColor Blue

$dataSourceConfig = @{
    name = "TimescaleDB"
    type = "postgres"
    url = "timescaledb:5432"
    database = "metrics"
    user = "prometheus"
    secureJsonData = @{
        password = "prometheus_password"
    }
    jsonData = @{
        sslmode = "disable"
        postgresVersion = 1500
        timescaledb = $true
    }
    access = "proxy"
} | ConvertTo-Json -Depth 3

$headers = @{
    "Content-Type" = "application/json"
}

# Create credentials for basic auth
$credential = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin"))
$headers["Authorization"] = "Basic $credential"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3090/api/datasources" -Method POST -Body $dataSourceConfig -Headers $headers
    Write-Host "TimescaleDB data source added successfully!" -ForegroundColor Green
} catch {
    Write-Host "Data source may already exist or there was an error: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Grafana is ready at: http://localhost:3090" -ForegroundColor Cyan
Write-Host "Login credentials: admin / admin" -ForegroundColor Cyan
Write-Host "Twitter dashboard can be imported from: twitter-nvidia-dashboard.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open Grafana in your browser" -ForegroundColor White
Write-Host "2. Go to Dashboards and Import" -ForegroundColor White
Write-Host "3. Upload the twitter-nvidia-dashboard.json file" -ForegroundColor White
Write-Host "4. Select the TimescaleDB data source" -ForegroundColor White
Write-Host "5. View your Twitter NVIDIA metrics!" -ForegroundColor White
