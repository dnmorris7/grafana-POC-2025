# Enterprise Metrics Collection POC

## Overview

This POC demonstrates a comprehensive metrics collection solution for:
1. **RabbitMQ Performance Monitoring** - Message flow rates, queue depths, and system health
2. **LLM Agent Performance Tracking** - Token statistics, response times, and cost analysis

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   RabbitMQ      │────│  Prometheus  │────│    Grafana      │
│   + Exporter    │    │   Scraper    │    │   Dashboard     │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │                       │
┌─────────────────┐           │              ┌─────────────────┐
│  LLM Metrics    │───────────┘              │   TimescaleDB   │
│   Service       │                          │  (Time Series)  │
└─────────────────┘                          └─────────────────┘
```

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
