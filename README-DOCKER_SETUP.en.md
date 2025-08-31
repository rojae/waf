# 🐳 WAF Docker Installation & Configuration Guide

## 🎯 Overview

This guide explains how to easily deploy and manage the complete WAF system using the integrated Docker Compose environment.

## 📋 System Requirements

### **Minimum Hardware Requirements**
- **CPU**: 4+ cores recommended
- **Memory**: 8GB RAM minimum, 16GB recommended
- **Disk**: 20GB+ (for logs and data storage)
- **Network**: Internet connection (for Docker images and OAuth)

### **Software Requirements**
- **Docker Engine**: 20.10 or higher
- **Docker Compose**: v2.0 or higher
- **Operating System**: Linux, macOS, Windows (Docker Desktop)

## 🚀 Quick Start

### **1. Integrated Execution (Recommended)**

```bash
# Clone repository
git clone https://github.com/rojae/waf
cd waf

# Run integrated startup script
./startup.sh
```

### **2. startup.sh Options**

#### **Basic Execution**
```bash
./startup.sh
```
- Quick start with existing images
- Use when running completed development services

#### **Build All Services**
```bash
./startup.sh --build
# or
./startup.sh -b
```
- Build and run all services
- Use when code changes need to be reflected

#### **Backend Only Build**
```bash
./startup.sh --build-backend
```
- Build only `waf-dashboard-api`, `waf-social-api`
- Use after modifying Java code

#### **Frontend Only Build**
```bash
./startup.sh --build-frontend
```
- Build only `waf-frontend`
- Use after modifying React/Next.js code

### **3. Manual Execution (Advanced Users)**

```bash
# Set environment variables
cp .env.example .env
# Edit .env file

# Run full system
docker-compose up -d

# Run specific services only
docker-compose up -d nginx kafka influxdb
```

## 🏗️ Docker Service Architecture

### **Core Infrastructure Services**

| Service | Container | Port | Role | Status |
|---------|-----------|------|------|--------|
| **nginx** | `waf-nginx` | 8080 | WAF + Web Server | ✅ |
| **kafka** | `waf-kafka` | 9092 | Message Streaming | ✅ |
| **influxdb** | `waf-influxdb` | 8086 | Time-series Database | ✅ |
| **elasticsearch** | `waf-elasticsearch` | 9200 | Log Search Engine | ✅ |
| **logstash** | `waf-logstash` | 5044 | ETL Pipeline | ✅ |
| **kibana** | `waf-kibana` | 5601 | Log Analysis Dashboard | ✅ |
| **grafana** | `waf-grafana` | 3000 | Metrics Dashboard | ✅ |
| **redis** | `waf-redis` | 6379 | Session Store | ✅ |

### **Processing Services**

| Service | Container | Port | Role | Status |
|---------|-----------|------|------|--------|
| **fluent-bit** | `waf-fluent-bit` | 2020 | Log Router | ✅ |
| **realtime-processor** | `waf-realtime-processor` | - | Real-time Processor | ✅ |
| **ksqldb** | `waf-ksqldb` | 8088 | Stream Processor | ✅ |

### **Application Services**

| Service | Container | Port | Role | Status |
|---------|-----------|------|------|--------|
| **waf-frontend** | `waf-frontend` | 3001 | Management Dashboard | ✅ |
| **waf-dashboard-api** | `waf-dashboard-api` | 8082 | Dashboard API | ✅ |
| **waf-social-api** | `waf-social-api` | 8081 | OAuth API | ✅ |

## ⚙️ Environment Configuration

### **Required Environment Variables (.env file)**

```bash
# Google OAuth Configuration (for dashboard login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Authentication Secrets
NEXTAUTH_SECRET=change-me-in-production-secret-key
JWT_SECRET=change-me-to-32-bytes-secret-key

# InfluxDB Token (for real-time metrics)
INFLUXDB_TOKEN=your-secure-influxdb-token
```

### **Google OAuth Setup**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing project
3. Navigate to "APIs & Services" > "Credentials"
4. Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3001/api/auth/callback/google`
5. Set Client ID and Client Secret in `.env` file

## 🔧 Development Environment Setup

### **Local Development Workflow**

```bash
# 1. Java backend development
./startup.sh --build-backend

# 2. Frontend development
./startup.sh --build-frontend

# 3. Infrastructure changes
./startup.sh --build

# 4. Restart specific service
docker-compose restart waf-dashboard-api

# 5. Check logs
docker logs -f waf-dashboard-api
```

### **Developer Tools**

```bash
# Check overall system status
docker-compose ps

# Real-time logs for specific service
docker logs -f waf-realtime-processor

# Container resource usage
docker stats

# Check Kafka topics
docker exec waf-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check InfluxDB data
docker exec waf-influxdb influx query 'SHOW MEASUREMENTS'
```

## 📊 Service Access URLs

### **User Interfaces**
- **WAF Management Dashboard**: http://localhost:3001 (Google login required)
- **Grafana Monitoring**: http://localhost:3000 (admin/admin)
- **Kibana Log Analysis**: http://localhost:5601

### **Developer APIs**
- **Dashboard API**: http://localhost:8082
- **OAuth API**: http://localhost:8081
- **Elasticsearch**: http://localhost:9200
- **InfluxDB**: http://localhost:8086
- **ksqlDB**: http://localhost:8088

### **Real-time Data Check**
- **Fluent Bit Health**: http://localhost:2020/api/v1/health
- **Kafka Bootstrap**: localhost:9092

## 🐛 Troubleshooting

### **Common Issues**

#### **1. Port Conflicts**
```bash
# Check ports in use
lsof -i :3001  # Dashboard port
lsof -i :8080  # WAF port

# Stop services
docker-compose down
```

#### **2. Memory Issues**
```bash
# Check memory usage
docker stats

# Clean unnecessary containers
docker system prune

# Adjust Java heap size (in docker-compose.yml)
environment:
  - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
```

#### **3. Google OAuth Error**
```bash
# Check redirect URI
# Set correct URI in Google Console:
http://localhost:3001/api/auth/callback/google

# Check environment variables
docker exec waf-frontend env | grep GOOGLE
```

#### **4. Service Startup Order Issues**
```bash
# Restart in dependency order
docker-compose down
docker-compose up -d kafka
sleep 10
docker-compose up -d
```

### **Log Debugging**

```bash
# All services logs
docker-compose logs -f

# Specific service error logs
docker logs waf-dashboard-api --tail 100

# Real-time processing pipeline debugging
docker logs waf-fluent-bit | grep ERROR
docker logs waf-realtime-processor | grep "level=error"
```

## 🔒 Security Considerations

### **Production Deployment**
- Do not commit `.env` file to Git
- Use strong JWT secrets (minimum 32 bytes)
- Regularly rotate InfluxDB tokens
- Block unnecessary ports with firewall rules

### **Network Security**
```bash
# Docker network isolation
docker network create --driver bridge waf-network

# Restrict external access (production)
ports:
  - "127.0.0.1:9200:9200"  # Elasticsearch local access only
```

## 📈 Monitoring & Maintenance

### **Daily Checklist**
```bash
# System health check
./scripts/health-check.sh

# Disk usage check
du -sh /var/lib/docker/

# Log file size check
docker system df
```

### **Periodic Maintenance**
```bash
# Log cleanup (weekly)
docker system prune

# Image updates (monthly)
docker-compose pull
docker-compose up -d

# Data backup (daily)
./scripts/backup.sh
```

## 🚀 Scaling & Optimization

### **High Traffic Environment Optimization**
```yaml
# docker-compose.override.yml
services:
  nginx:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
  
  kafka:
    environment:
      KAFKA_NUM_NETWORK_THREADS: 8
      KAFKA_NUM_IO_THREADS: 16
```

### **Horizontal Scaling**
```bash
# Scale out processing services
docker-compose up -d --scale realtime-processor=3
docker-compose up -d --scale logstash=2
```

## 📚 Additional Resources

### **Useful Commands**
```bash
# Complete system restart
docker-compose down && docker-compose up -d

# View service dependencies
docker-compose config

# Export service logs
docker-compose logs > waf-system.log

# Clean everything (CAUTION: removes all data)
docker-compose down -v
docker system prune -a
```

### **Performance Monitoring**
```bash
# Monitor real-time metrics
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check network traffic
docker exec waf-nginx ss -tuln

# Monitor Kafka lag
docker exec waf-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

---

**💡 Help**: If you encounter Docker-related issues, try a complete rebuild with `./startup.sh --build` first.