#!/bin/bash
echo "Configuring Grafana TimescaleDB data source..."

# Wait for Grafana to be ready
until curl -s http://localhost:3090/api/health > /dev/null; do
  echo "Waiting for Grafana to be ready..."
  sleep 2
done

# Add TimescaleDB data source
curl -X POST \
  http://admin:admin@localhost:3090/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TimescaleDB",
    "type": "postgres",
    "url": "timescaledb:5432",
    "database": "metrics",
    "user": "prometheus",
    "secureJsonData": {
      "password": "prometheus_password"
    },
    "jsonData": {
      "sslmode": "disable",
      "postgresVersion": 1500,
      "timescaledb": true
    },
    "access": "proxy"
  }' \
  || echo "Data source may already exist"

echo "TimescaleDB data source configured!"

# Import Twitter dashboard
echo "Importing Twitter NVIDIA dashboard..."
curl -X POST \
  http://admin:admin@localhost:3090/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @twitter-nvidia-dashboard.json \
  || echo "Dashboard may already exist"

echo "Dashboard imported!"
echo "✅ Grafana configuration complete!"
echo "🌐 Access Grafana at: http://localhost:3090"
echo "👤 Login: admin / admin"
