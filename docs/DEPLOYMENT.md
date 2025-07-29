# Deployment Guide

## Prerequisites

### System Requirements
- **Docker**: Version 20.10+ 
- **Docker Compose**: Version 2.0+
- **RAM**: Minimum 8GB, Recommended 16GB
- **CPU**: Minimum 4 cores, Recommended 8 cores
- **Storage**: Minimum 20GB free space, Recommended 100GB
- **Network**: Ports 3000, 5432, 5672, 8080, 9090, 15672 available

### Environment Setup

#### Windows
1. Install Docker Desktop from [docker.com](https://docker.com)
2. Enable WSL2 backend
3. Ensure virtualization is enabled in BIOS

#### Linux
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### macOS
```bash
# Install via Homebrew
brew install docker docker-compose
```

## Quick Start Deployment

### 1. Clone Repository
```bash
git clone <repository-url>
cd grafana-poc-2025
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration (optional)
# Set OPENAI_API_KEY for real LLM integration
export OPENAI_API_KEY="your-openai-api-key"
```

### 3. Start Services
```bash
# Windows
.\start-poc.bat

# Linux/macOS
chmod +x start-poc.sh
./start-poc.sh
```

### 4. Verify Deployment
```bash
# Check service health
docker-compose ps

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:9090/metrics
```

## Production Deployment

### 1. Security Configuration

#### SSL/TLS Setup
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - grafana
      - prometheus
```

#### Secrets Management
```bash
# Create secrets
docker secret create postgres_password postgres_password.txt
docker secret create grafana_admin_password grafana_admin_password.txt

# Use in compose file
services:
  timescaledb:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
```

### 2. High Availability Setup

#### Load Balancer Configuration
```nginx
upstream grafana_backend {
    server grafana-1:3000;
    server grafana-2:3000;
}

upstream prometheus_backend {
    server prometheus-1:9090;
    server prometheus-2:9090;
}
```

#### Database Clustering
```yaml
# TimescaleDB cluster setup
services:
  timescaledb-primary:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_REPLICATION_MODE: master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replication_password

  timescaledb-replica:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: timescaledb-primary
```

### 3. Monitoring & Alerting

#### Prometheus Federation
```yaml
# prometheus-federation.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'federate'
    scrape_interval: 15s
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job=~".*"}'
    static_configs:
      - targets:
        - 'prometheus-dc1:9090'
        - 'prometheus-dc2:9090'
```

#### Alertmanager Configuration
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@company.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://pagerduty-integration:8080/webhook'
```

## Kubernetes Deployment

### 1. Namespace Setup
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: metrics-system
```

### 2. Helm Charts
```bash
# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add timescale https://charts.timescale.com

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace metrics-system \
  --values prometheus-values.yaml

# Install Grafana
helm install grafana grafana/grafana \
  --namespace metrics-system \
  --values grafana-values.yaml

# Install TimescaleDB
helm install timescaledb timescale/timescaledb-single \
  --namespace metrics-system \
  --values timescaledb-values.yaml
```

### 3. Custom Resources
```yaml
# llm-metrics-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-metrics-service
  namespace: metrics-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-metrics-service
  template:
    metadata:
      labels:
        app: llm-metrics-service
    spec:
      containers:
      - name: llm-metrics-service
        image: your-registry/llm-metrics-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: TIMESCALE_HOST
          value: "timescaledb-service"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
```

## Backup & Recovery

### 1. Database Backup
```bash
#!/bin/bash
# backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# TimescaleDB backup
docker exec timescaledb pg_dump -U prometheus metrics > "$BACKUP_DIR/timescaledb_$DATE.sql"

# Prometheus data backup
docker cp prometheus:/prometheus/data "$BACKUP_DIR/prometheus_data_$DATE"

# Compress backups
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" "$BACKUP_DIR"/*_$DATE*

# Upload to cloud storage (example: AWS S3)
aws s3 cp "$BACKUP_DIR/backup_$DATE.tar.gz" s3://your-backup-bucket/
```

### 2. Automated Backup
```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: metrics-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h timescaledb -U prometheus metrics > /backup/backup_$(date +%Y%m%d).sql
              aws s3 cp /backup/backup_$(date +%Y%m%d).sql s3://backup-bucket/
          restartPolicy: OnFailure
```

## Troubleshooting

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
docker-compose logs [service-name]

# Check resource usage
docker stats

# Verify port availability
netstat -tlnp | grep :3000
```

#### 2. Database Connection Issues
```bash
# Test database connection
docker exec timescaledb psql -U prometheus -d metrics -c "SELECT NOW();"

# Check network connectivity
docker exec grafana nc -zv timescaledb 5432
```

#### 3. Memory Issues
```bash
# Increase Docker memory limits
# Edit Docker Desktop settings or /etc/docker/daemon.json

# Monitor memory usage
docker exec prometheus cat /proc/meminfo
```

### Performance Tuning

#### 1. Prometheus Optimization
```yaml
# prometheus.yml
global:
  scrape_interval: 30s  # Increase interval for less load
  evaluation_interval: 30s

storage:
  tsdb:
    retention.time: 15d  # Reduce retention for less storage
    retention.size: 10GB
```

#### 2. TimescaleDB Tuning
```sql
-- Optimize TimescaleDB settings
ALTER SYSTEM SET shared_preload_libraries = 'timescaledb';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
```

## Monitoring the Monitors

### 1. Infrastructure Monitoring
```yaml
# Add node-exporter for system metrics
services:
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
```

### 2. Service Health Checks
```yaml
services:
  grafana:
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Maintenance

### 1. Update Procedure
```bash
# 1. Backup current state
./backup.sh

# 2. Update images
docker-compose pull

# 3. Rolling update
docker-compose up -d --no-deps grafana
docker-compose up -d --no-deps prometheus
docker-compose up -d --no-deps llm-metrics-service

# 4. Verify health
./health-check.sh
```

### 2. Log Rotation
```yaml
services:
  grafana:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Security Hardening

### 1. Network Security
```yaml
# Create custom network
networks:
  metrics-internal:
    driver: bridge
    internal: true
  metrics-external:
    driver: bridge

services:
  grafana:
    networks:
      - metrics-external
      - metrics-internal
  
  timescaledb:
    networks:
      - metrics-internal  # No external access
```

### 2. User Management
```bash
# Create non-root users in containers
# Add to Dockerfiles:
RUN groupadd -r metrics && useradd -r -g metrics metrics
USER metrics
```

This deployment guide provides comprehensive instructions for both development and production deployments, ensuring your metrics collection solution is robust, secure, and scalable.
