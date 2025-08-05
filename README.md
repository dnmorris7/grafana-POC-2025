# 📊 Twitter/NVIDIA Metrics Dashboard - Grafana POC 2025

A comprehensive real-time analytics system that monitors Twitter/NVIDIA mentions and visualizes engagement metrics using RabbitMQ, TimescaleDB, and Grafana.

## 🏗️ **Architecture Overview**

```
Twitter Messages → RabbitMQ → TimescaleDB → Grafana Dashboard
                      ↓
                 Live Streaming → Grafana RabbitMQ Plugin
```

**Components:**
- **RabbitMQ**: Message broker for real-time Twitter data
- **TimescaleDB**: Time-series database for historical data storage
- **Grafana**: Visualization and dashboards
- **Prometheus**: Metrics collection
- **Demo Producer**: Simulates Twitter/NVIDIA messages

## 🚀 **Quick Start**

### **Prerequisites**
- Docker Desktop installed and running
- Windows PowerShell (or equivalent terminal)
- At least 4GB free RAM

### **1. Clone and Navigate**
```bash
git clone https://github.com/dnmorris7/grafana-POC-2025.git
cd grafana-POC-2025
```

### **2. Start All Services**
```bash
# Start the entire stack
docker-compose up -d

# Wait for services to initialize (about 30-60 seconds)
docker-compose ps
```

### **3. Verify Services are Running**
```bash
# Check all containers are healthy
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
NAMES               STATUS                 PORTS
grafana             Up X minutes           0.0.0.0:3090->3000/tcp
rabbitmq            Up X minutes           0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp, 0.0.0.0:5552->5552/tcp
timescaledb         Up X minutes           0.0.0.0:5432->5432/tcp
prometheus          Up X minutes           0.0.0.0:9090->9090/tcp
rabbitmq-demo       Up X minutes           
rabbitmq-exporter   Up X minutes (healthy) 0.0.0.0:9419->9419/tcp
```

### **4. Access the Applications**

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana Dashboard** | http://localhost:3090 | admin / admin |
| **RabbitMQ Management** | http://localhost:15672 | guest / guest |
| **Prometheus** | http://localhost:9090 | No auth required |
| **TimescaleDB** | localhost:5432 | prometheus / prometheus_password |

## 📊 **Setting Up the Dashboard**

### **Step 1: Configure TimescaleDB Data Source**

1. Open Grafana: http://localhost:3090
2. Login with `admin` / `admin`
3. Go to **Configuration → Data Sources → Add data source**
4. Select **PostgreSQL**
5. Configure:
   ```
   Name: TimescaleDB
   Host: timescaledb:5432
   Database: metrics
   User: prometheus
   Password: prometheus_password
   SSL Mode: disable
   TimescaleDB: ✓ (checked)
   ```
6. Click **Save & Test** - should show "Database Connection OK"

### **Step 2: Configure RabbitMQ Streams Data Source**

1. In Grafana, go to **Configuration → Data Sources → Add data source**
2. Select **RabbitMQ** (install plugin if needed)
3. Configure:
   ```
   Name: RabbitMQ-Streams
   Host: rabbitmq
   AMQP Port: 5672
   Stream Port: 5552
   VHost: /
   Username: guest
   Password: guest
   TLS Connection: OFF
   
   Stream Settings:
   Stream Name: rabbitmq.stream
   Consumer Name: grafana-consumer
   Offset From Start: ON
   ```
4. Add Exchanges:
   - `rabbitmq.exchange`
   - `twitter.exchange`
   - `orders.exchange`
   - `notifications.exchange`
   - `analytics.exchange`
5. Click **Save & Test**

### **Step 3: Import Twitter Dashboard**

1. Go to **Dashboards → Import**
2. Upload `twitter-nvidia-dashboard.json`
3. Select **TimescaleDB** as the data source
4. Click **Import**

### **Step 4: Add Sample Data**

#### **Quick LLM Data Generation (Recommended)**
Use the provided batch scripts for easy LLM data generation:

**Windows Batch Script:**
```bash
# Run the interactive batch script
.\generate-llm-data.bat
```

**PowerShell Script:**
```powershell
# Run the PowerShell script
.\generate-llm-data.ps1
```

These scripts will:
- ✅ Check if services are running
- ✅ Test connectivity to LLM service
- ✅ Generate customizable amount of sample data
- ✅ Verify data was created successfully
- ✅ Show summary of generated metrics
- ✅ Provide next steps and useful commands

#### **Twitter Sample Data**
Run this command to insert sample Twitter data:
```bash
docker exec -it timescaledb psql -U prometheus -d metrics -c "
INSERT INTO metrics.twitter_metrics (message_id, message_type, topic, text, hashtag, author_username, author_followers, likes, retweets, replies, sentiment, routing_key, timestamp) VALUES 
(12345, 'tweet', 'nvidia', 'NVIDIA just announced amazing new RTX cards! #NVIDIA #AI', '#NVIDIA', 'tech_enthusiast', 15000, 245, 89, 67, 'positive', 'twitter.nvidia.tweet', NOW() - INTERVAL '5 minutes'),
(12346, 'retweet', 'nvidia', 'RT @nvidia: Exciting developments in AI computing!', '#AI', 'ai_researcher', 8500, 156, 34, 23, 'positive', 'twitter.nvidia.retweet', NOW() - INTERVAL '3 minutes'),
(12347, 'tweet', 'nvidia', 'Mixed feelings about the new NVIDIA pricing strategy', '#NVIDIA', 'budget_gamer', 2300, 45, 12, 78, 'neutral', 'twitter.nvidia.tweet', NOW() - INTERVAL '1 minute'),
(12348, 'tweet', 'nvidia', 'NVIDIA stock prices are too high, disappointed with recent performance', '#NVIDIA', 'stock_trader', 25000, 23, 8, 145, 'negative', 'twitter.nvidia.tweet', NOW());"
```

## 🎯 **What You'll See**

### **Twitter/NVIDIA Dashboard Features:**
- **📈 Time Series Panel**: Tweet engagement over time
- **🥧 Sentiment Distribution**: Pie chart of positive/neutral/negative sentiment
- **📊 Message Volume**: Bar chart comparing tweets vs retweets
- **👥 Top Authors**: Table of most active Twitter users
- **🔥 Trending Hashtags**: Popular hashtags analysis

### **Real-time Data Flow:**
- The `rabbitmq-demo` container produces Twitter/NVIDIA messages every 5 seconds
- Messages flow through RabbitMQ exchanges
- TimescaleDB stores historical data
- Grafana displays both real-time streams and historical analytics

## 🔧 **Troubleshooting**

### **Services Won't Start**
```bash
# Check Docker is running
docker --version

# Restart services
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs <service-name>
```

### **RabbitMQ Connection Issues**
```bash
# Verify RabbitMQ streams plugin is enabled
docker exec rabbitmq rabbitmq-plugins list

# Check if port 5552 is exposed
docker port rabbitmq

# Test connection from Grafana to RabbitMQ
docker exec grafana nc -zv rabbitmq 5552
```

### **No Data in Dashboard**
```bash
# Check if sample data exists
docker exec -it timescaledb psql -U prometheus -d metrics -c "SELECT COUNT(*) FROM metrics.twitter_metrics;"

# Check RabbitMQ queues
docker exec rabbitmq rabbitmqctl list_queues

# Restart demo producer
docker-compose restart rabbitmq-demo
```

### **Grafana Plugin Issues**
```bash
# Install RabbitMQ plugin manually
docker exec grafana grafana-cli plugins install grafana-rabbitmq-datasource
docker-compose restart grafana
```

## 🛠️ **Development**

### **Adding Custom Dashboards**
1. Create dashboard in Grafana
2. Export JSON via **Share → Export**
3. Save to `./grafana/dashboards/`
4. Restart Grafana: `docker-compose restart grafana`

### **Modifying Data Schema**
1. Update `./timescaledb/init.sql`
2. Update `./timescaledb/twitter-schema.sql`
3. Recreate TimescaleDB: 
   ```bash
   docker-compose down
   docker volume rm grafana-poc-2025_timescaledb_data
   docker-compose up -d timescaledb
   ```

### **Custom Message Producers**
1. Modify `./rabbitmq-demo/src/index.js`
2. Rebuild: `docker-compose build rabbitmq-demo`
3. Restart: `docker-compose restart rabbitmq-demo`

## 📁 **Project Structure**
```
grafana-POC-2025/
├── docker-compose.yml              # Main orchestration
├── start-poc.bat                   # Windows startup script
├── generate-llm-data.bat          # LLM data generation (Batch)
├── generate-llm-data.ps1          # LLM data generation (PowerShell)
├── twitter-nvidia-dashboard.json   # Grafana dashboard
├── setup-grafana.ps1              # Automated setup script
├── grafana/
│   ├── provisioning/               # Grafana config
│   └── dashboards/                 # Dashboard JSON files
├── timescaledb/
│   ├── init.sql                    # Database initialization
│   └── twitter-schema.sql          # Twitter data schema
├── rabbitmq/
│   ├── enabled_plugins             # RabbitMQ plugins
│   └── rabbitmq.conf              # RabbitMQ configuration
├── rabbitmq-demo/                  # Message producer
└── llm-metrics-service/            # Metrics collection service
```

## 🎉 **Success Indicators**

When everything is working correctly, you should see:
- ✅ All Docker containers running
- ✅ Grafana accessible at localhost:3090
- ✅ TimescaleDB data source connected
- ✅ RabbitMQ data source connected
- ✅ Twitter dashboard showing metrics
- ✅ Real-time message flow in RabbitMQ management UI

## 🔗 **Useful Commands**

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# View service logs
docker-compose logs -f <service-name>

# Scale the demo producer
docker-compose up -d --scale rabbitmq-demo=3

# Backup TimescaleDB data
docker exec timescaledb pg_dump -U prometheus metrics > backup.sql

# Generate LLM sample data (Windows)
.\generate-llm-data.bat

# Generate LLM sample data (PowerShell)
.\generate-llm-data.ps1

# Manual LLM data generation
curl -X POST http://localhost:8090/api/demo/generate-metrics \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'

# Check LLM service health
curl http://localhost:8090/health

# View LLM metrics summary
curl http://localhost:8090/api/metrics/llm/summary?timeRange=1h
```

## 📝 **Next Steps**

1. **Connect Real Twitter API**: Replace demo producer with actual Twitter API integration
2. **Add Alerting**: Configure Grafana alerts for sentiment thresholds
3. **Scale Horizontally**: Add multiple RabbitMQ/TimescaleDB instances
4. **Machine Learning**: Integrate ML models for advanced sentiment analysis
5. **Export Data**: Set up automated data exports and reporting

---

## 🆘 **Support**

For issues and questions:
1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose logs`
3. Verify all ports are available
4. Ensure Docker Desktop has sufficient resources

**Happy Analytics!** 📊🚀

## Technology Stack

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboarding
- **TimescaleDB**: High-performance time-series storage
- **RabbitMQ**: Message broker with prometheus exporter
- **Node.js/TypeScript**: LLM metrics collection service
- **Docker Compose**: Container orchestration

## Quick Start

```bash
# Clone and start all services
docker-compose up -d

# Access services
- **Grafana Dashboard**: http://localhost:3090 (admin/admin)
- Prometheus: http://localhost:9090
- RabbitMQ Management: http://localhost:15672 (guest/guest)
- LLM Metrics API: http://localhost:8080
```

## Features

### RabbitMQ Monitoring
- Message flow rates per exchange/queue
- Queue depth and consumer metrics
- Connection and channel monitoring
- Resource utilization tracking

### LLM Agent Metrics
- Time to first token (TTFT)
- Token generation speed (tokens/second)
- Cost per response tracking
- Request volume and error rates

## Enterprise Considerations

### Scalability
- Horizontal scaling via Prometheus federation
- TimescaleDB clustering for large deployments
- Grafana enterprise features for team collaboration

### Security
- Authentication and authorization
- Encrypted data in transit
- Role-based access control

### Compliance
- Data retention policies
- Audit logging
- Backup and disaster recovery

## Directory Structure

```
├── docker-compose.yml          # Main orchestration
├── prometheus/                 # Prometheus configuration
├── grafana/                   # Grafana dashboards & config
├── rabbitmq/                  # RabbitMQ setup
├── llm-metrics-service/       # TypeScript service for LLM tracking
├── timescaledb/              # Database initialization
└── docs/                     # Additional documentation
```
