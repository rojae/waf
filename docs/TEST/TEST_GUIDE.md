# 🧪 Enterprise WAF Dual-Track Architecture Testing Guide

This document provides comprehensive testing procedures for the dual-track WAF system that separates real-time logs from analytical logs for optimal performance and threat detection.

## 📋 Table of Contents

1. [System Initialization](#1-system-initialization)
2. [Service Health Validation](#2-service-health-validation)
3. [Real-time Track Testing](#3-real-time-track-testing)
4. [Analytics Track Testing](#4-analytics-track-testing)
5. [Log Segregation Verification](#5-log-segregation-verification)
6. [Monitoring & Dashboards](#6-monitoring--dashboards)
7. [Performance Testing](#7-performance-testing)
8. [Troubleshooting](#8-troubleshooting)
9. [Enterprise Considerations](#9-enterprise-considerations)

---

## 1. System Initialization

### 1.1 Complete System Startup
```bash
# Navigate to project root directory
cd /waf

# Grant execution permissions and start system
chmod +x startup.sh
./startup.sh
```

### 1.2 Individual Service Management (Development Mode)
```bash
# Start all services in background
docker-compose up -d

# Restart specific services for debugging
docker-compose restart fluent-bit
docker-compose restart realtime-processor

# Scale specific services for load testing
docker-compose up -d --scale realtime-processor=3
```

---

## 2. Service Health Validation

### 2.1 Comprehensive Service Status
```bash
# Check all container statuses
docker-compose ps

# Monitor health check status
docker-compose ps | grep -E "(healthy|unhealthy)"

# Verify service dependencies
docker-compose config --services
```

### 2.2 Individual Service Health Checks
```bash
# WAF Engine Health Check
curl -I http://localhost:8080
# Expected: HTTP/1.1 200 OK

# Elasticsearch Cluster Health
curl http://localhost:9200/_cluster/health?pretty
# Expected: "status" : "yellow" or "green"

# InfluxDB Health (Real-time Track)
curl http://localhost:8086/ping
# Expected: HTTP/1.1 204 No Content

# ksqlDB Health (Analytics Track)
curl http://localhost:8088/info | jq '.KsqlServerInfo.version'
# Expected: Version information

# Kafka Topic Verification
docker exec -it waf-kafka kafka-topics --list --bootstrap-server kafka:9092
# Expected: All required topics listed
```

### 2.3 Expected Healthy State
A properly functioning system should display:
- **nginx**: healthy status (port 8080)
- **kafka**: healthy status (port 9092)
- **redis-streams**: healthy status (port 6380)
- **influxdb**: healthy status (port 8086)
- **elasticsearch**: yellow/green cluster status (port 9200)
- **kibana**: accessible web interface (port 5601)

---

## 3. Real-time Track Testing

The real-time track processes **high-severity attacks** and generates **alerts within 5 seconds**.

### 3.1 SQL Injection Attack Vectors
```bash
# Basic SQLi - Immediate blocking with real-time alert
curl -i "http://localhost:8080/test.html?id=1%27%20OR%20%271%27=%271"
# Expected: HTTP/1.1 403 Forbidden

# Union-based SQL Injection
curl -i "http://localhost:8080/search?q=admin%27%20UNION%20SELECT%201,2,3--"
# Expected: HTTP/1.1 403 Forbidden, Rule ID: 942*

# Time-based SQL Injection
curl -i "http://localhost:8080/login?user=admin%27%20AND%20SLEEP(5)--"
# Expected: HTTP/1.1 403 Forbidden, High anomaly score

# Boolean-based Blind SQLi
curl -i "http://localhost:8080/user?id=1%27%20AND%201=1--"
# Expected: Blocked by rule 942130 or similar
```

### 3.2 Cross-Site Scripting (XSS) Attack Vectors
```bash
# Script tag XSS
curl -i "http://localhost:8080/?p=%3Cscript%3Ealert(%27xss%27)%3C/script%3E"
# Expected: HTTP/1.1 403 Forbidden, Rule ID: 941100

# Event handler XSS
curl -i "http://localhost:8080/?data=%3Cimg%20src=x%20onerror=alert(1)%3E"
# Expected: Blocked by rule 941160 or similar

# JavaScript protocol XSS
curl -i "http://localhost:8080/?url=javascript:alert(document.cookie)"
# Expected: HTTP/1.1 403 Forbidden

# DOM-based XSS simulation
curl -i "http://localhost:8080/?callback=%3Cscript%3Ealert(document.domain)%3C/script%3E"
# Expected: Multiple XSS rules triggered
```

### 3.3 Remote Code Execution (RCE) Attack Vectors
```bash
# PHP code injection
curl -i "http://localhost:8080/" -H "User-Agent: <?php system('whoami'); ?>"
# Expected: HTTP/1.1 403 Forbidden, Rule ID: 933*

# Command injection attempt
curl -i "http://localhost:8080/cmd?exec=ls%20-la;%20id"
# Expected: Blocked by rule 932*

# Server-side template injection
curl -i "http://localhost:8080/template?data={{7*7}}"
# Expected: RCE detection and blocking

# Python code injection
curl -i "http://localhost:8080/eval" --data "code=__import__('os').system('id')"
# Expected: HTTP/1.1 403 Forbidden
```

### 3.4 Local File Inclusion (LFI) Attack Vectors
```bash
# Basic LFI attempt
curl -i "http://localhost:8080/page?file=../../../etc/passwd"
# Expected: HTTP/1.1 403 Forbidden, Rule ID: 930100

# URL-encoded LFI
curl -i "http://localhost:8080/include?path=%252e%252e%252fetc%252fpasswd"
# Expected: Blocked by rule 930110

# Windows LFI simulation
curl -i "http://localhost:8080/file?name=..\\..\\..\\windows\\system32\\drivers\\etc\\hosts"
# Expected: Path traversal detection
```

### 3.5 Real-time Track Verification
```bash
# Monitor real-time processor logs
docker logs waf-realtime-processor --tail 20 -f

# Check Redis Streams for real-time events
docker exec -it waf-redis-streams redis-cli XREAD STREAMS waf-realtime-events 0

# Query InfluxDB for recent metrics
curl -G 'http://localhost:8086/query' \
  --data-urlencode "q=SELECT * FROM waf_events WHERE time > now() - 1m"

# Verify alert generation
docker exec -it waf-redis-streams redis-cli LRANGE waf:alerts 0 -1
```

---

## 4. Analytics Track Testing

The analytics track processes **scanner traffic** and **general logs** for **long-term analysis**.

### 4.1 Vulnerability Scanner Simulation
```bash
# Nikto scanner simulation
curl "http://localhost:8080/admin/" -H "User-Agent: Nikto/2.1.6"
curl "http://localhost:8080/config/" -H "User-Agent: Nikto/2.1.6"  
curl "http://localhost:8080/backup/" -H "User-Agent: Nikto/2.1.6"
# Expected: Logs stored in waf-scanner-* index, no real-time alerts

# Nmap script engine simulation
curl "http://localhost:8080/" -H "User-Agent: Mozilla/5.0 (compatible; Nmap Scripting Engine)"
# Expected: Detected as scanner traffic

# Generic security scanner patterns
curl "http://localhost:8080/.git/" -H "User-Agent: scanner/1.0"
curl "http://localhost:8080/.env" -H "User-Agent: security-scanner"
curl "http://localhost:8080/robots.txt" -H "User-Agent: vulnerability-scanner"
```

### 4.2 Directory Brute-force Simulation
```bash
# Common directory enumeration
common_dirs=("admin" "config" "backup" "test" "dev" "api" "docs" "files" "uploads" "assets")
for dir in "${common_dirs[@]}"; do
  curl -s "http://localhost:8080/$dir/" -H "User-Agent: DirBuster/1.0" >/dev/null
  echo "Scanned: $dir - $(date '+%H:%M:%S')"
  sleep 0.1
done
```

### 4.3 File Extension Enumeration
```bash
# Backup file discovery attempts
extensions=("bak" "old" "tmp" "backup" "orig" "save" "swp" "conf")
base_files=("index" "config" "settings" "database" "app")
for file in "${base_files[@]}"; do
  for ext in "${extensions[@]}"; do
    curl -s "http://localhost:8080/${file}.${ext}" >/dev/null
  done
done
```

### 4.4 Analytics Track Verification
```bash
# Verify scanner logs in separate index
curl -s "http://localhost:9200/waf-scanner-*/_search?size=5" | jq '.hits.total.value'
# Expected: Non-zero count for scanner events

# Check general analytics logs
curl -s "http://localhost:9200/waf-logs-*/_search?q=scanner" | jq '.hits.total.value'

# Verify ksqlDB stream processing
docker exec -it waf-ksqldb ksql http://localhost:8088 \
  -e "SELECT * FROM MODSEC_LEGITIMATE EMIT CHANGES LIMIT 5;"
```

---

## 5. Log Segregation Verification

### 5.1 Elasticsearch Index Analysis
```bash
# List all WAF-related indices
curl "http://localhost:9200/_cat/indices?v" | grep waf

# Expected index patterns:
# - waf-logs-YYYY.MM.DD (general logs)
# - waf-scanner-YYYY.MM.DD (scanner logs)
# - waf-enriched-YYYY.MM.DD (ksqlDB processed logs)  
# - waf-metrics-YYYY.MM.DD (aggregated metrics)
# - waf-realtime-archive-YYYY.MM.DD (real-time archives)

# Check index sizes and document counts
curl -s "http://localhost:9200/_cat/indices/waf-*?v&s=store.size:desc"
```

### 5.2 Log Classification Verification
```bash
# High-severity events (Real-time track)
curl -s "http://localhost:9200/waf-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"range": {"transaction.anomaly_score": {"gte": 50}}},
          {"range": {"@timestamp": {"gte": "now-1h"}}}
        ]
      }
    },
    "size": 5,
    "sort": [{"@timestamp": {"order": "desc"}}]
  }' | jq '.hits.hits[]._source.transaction.messages[0].details.ruleId'

# Scanner detection events (Analytics track)
curl -s "http://localhost:9200/waf-scanner-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "wildcard": {
        "transaction.messages.details.ruleId": "913*"
      }
    },
    "size": 3
  }' | jq '.hits.total.value'

# Low-severity events (Analytics track)
curl -s "http://localhost:9200/waf-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "range": {
        "transaction.anomaly_score": {"lt": 30}
      }
    },
    "size": 3
  }' | jq '.hits.total.value'
```

### 5.3 Log Volume Analysis
```bash
# Document count by index type
echo "=== Log Volume Analysis ==="
for index in waf-logs waf-scanner waf-enriched waf-metrics; do
  count=$(curl -s "http://localhost:9200/${index}-*/_count" | jq '.count')
  echo "$index: $count documents"
done

# Storage usage by index
curl -s "http://localhost:9200/_cat/indices/waf-*?v&h=index,docs.count,store.size" | sort -k3 -hr
```

---

## 6. Monitoring & Dashboards

### 6.1 Web Interface Access Points
| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **Kibana** | http://localhost:5601 | None | Log analysis and visualization |
| **InfluxDB UI** | http://localhost:8086 | admin/adminpassword | Real-time metrics dashboard |
| **ksqlDB Info** | http://localhost:8088/info | None | Stream processing status |
| **Elasticsearch** | http://localhost:9200 | None | Direct API access |

### 6.2 Kibana Dashboard Configuration
```bash
# Index patterns to create in Kibana:
# 1. waf-logs-* (General security logs)
# 2. waf-scanner-* (Scanner detection logs)
# 3. waf-enriched-* (Processed analytical logs)  
# 4. waf-metrics-* (Aggregated metrics)

# Access Kibana at http://localhost:5601
# Navigate: Management > Stack Management > Index Patterns > Create index pattern
```

### 6.3 Real-time Monitoring Queries
```bash
# Attack statistics for the last minute
curl -s "http://localhost:9200/waf-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 0,
    "query": {
      "range": {
        "@timestamp": {
          "gte": "now-1m"
        }
      }
    },
    "aggs": {
      "attack_types": {
        "terms": {
          "field": "transaction.messages.details.ruleId.keyword",
          "size": 10
        }
      },
      "severity_distribution": {
        "histogram": {
          "field": "transaction.anomaly_score",
          "interval": 10
        }
      }
    }
  }' | jq '.aggregations'

# Top attacking IP addresses
curl -s "http://localhost:9200/waf-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 0,
    "query": {
      "range": {
        "@timestamp": {
          "gte": "now-1h"
        }
      }
    },
    "aggs": {
      "top_attackers": {
        "terms": {
          "field": "transaction.client_ip.keyword",
          "size": 10
        },
        "aggs": {
          "attack_count": {
            "value_count": {
              "field": "transaction.id.keyword"
            }
          }
        }
      }
    }
  }' | jq '.aggregations.top_attackers.buckets[]'
```

---

## 7. Performance Testing

### 7.1 Load Testing Tool Setup
```bash
# Install Apache Bench (macOS)
brew install httpd

# Install hey (Go-based load tester)
go install github.com/rakyll/hey@latest

# Install wrk (Alternative load tester)
brew install wrk

# Verify installations
ab -V
hey -version
wrk --version
```

### 7.2 Legitimate Traffic Load Testing
```bash
# Basic load test - 1000 requests, 10 concurrent
ab -n 1000 -c 10 -H "User-Agent: LoadTester/1.0" http://localhost:8080/

# Advanced load test with hey
hey -n 1000 -c 10 -t 30 -H "User-Agent: Enterprise-LoadTest" http://localhost:8080/

# Sustained load test with wrk
wrk -t12 -c400 -d30s --header "User-Agent: Benchmark-Client" http://localhost:8080/

# Gradual ramp-up test
for concurrency in 1 5 10 20 50; do
  echo "Testing with $concurrency concurrent users..."
  ab -n 100 -c $concurrency http://localhost:8080/ | grep "Requests per second"
  sleep 5
done
```

### 7.3 Attack Traffic Load Testing
```bash
# XSS attack simulation (high volume)
echo "=== XSS Attack Load Test ==="
for i in {1..100}; do
  curl -s "http://localhost:8080/?test=$i%3Cscript%3Ealert($i)%3C/script%3E" \
    -H "User-Agent: AttackBot-$i" >/dev/null &
  if (( i % 10 == 0 )); then
    echo "Launched $i attack requests..."
  fi
done
wait
echo "XSS attack simulation completed"

# SQL injection attack simulation
echo "=== SQLi Attack Load Test ==="  
for i in {1..50}; do
  curl -s "http://localhost:8080/search?id=$i%27%20OR%20%271%27=%271" \
    -H "User-Agent: SQLBot-$i" >/dev/null &
done
wait
echo "SQLi attack simulation completed"

# Mixed attack pattern simulation
echo "=== Mixed Attack Pattern Test ==="
attack_types=("xss" "sqli" "lfi" "rce")
for i in {1..200}; do
  attack_type=${attack_types[$((i % 4))]}
  case $attack_type in
    "xss")
      curl -s "http://localhost:8080/?q=%3Cscript%3Ealert($i)%3C/script%3E" >/dev/null &
      ;;
    "sqli") 
      curl -s "http://localhost:8080/login?id=$i%27%20OR%201=1--" >/dev/null &
      ;;
    "lfi")
      curl -s "http://localhost:8080/file?path=../../../etc/passwd" >/dev/null &
      ;;
    "rce")
      curl -s "http://localhost:8080/" -H "User-Agent: <?php system('id'); ?>" >/dev/null &
      ;;
  esac
  if (( i % 50 == 0 )); then
    echo "Launched $i mixed attack requests..."
  fi
done
wait
```

### 7.4 Performance Metrics Collection
```bash
# Container resource utilization
echo "=== Docker Container Performance ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Response time analysis
echo "=== Response Time Analysis ==="
curl -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | Total: %{time_total}s\n" \
  -s "http://localhost:8080/" >/dev/null

# Log processing throughput
echo "=== Log Processing Performance ==="
docker logs waf-realtime-processor 2>/dev/null | grep "Processed real-time event" | tail -10

# Elasticsearch indexing performance  
echo "=== Elasticsearch Performance ==="
curl -s "http://localhost:9200/_stats/indexing" | jq '.indices | to_entries[] | select(.key | startswith("waf-")) | {index: .key, indexing_rate: .value.total.indexing.index_total}'

# System resource monitoring
echo "=== System Resources ==="
echo "CPU Usage: $(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}')"
echo "Memory Usage: $(top -l 1 -n 0 | grep "PhysMem" | awk '{print $2}')"
echo "Disk I/O: $(iostat -d 1 2 | tail -1 | awk '{print $2 " KB/t read, " $3 " KB/t write"}')"
```

---

## 8. Troubleshooting

### 8.1 Common Issue Resolution

#### Service Startup Failures
```bash
# Check port conflicts
echo "=== Port Conflict Analysis ==="
netstat -an | grep -E ":(8080|9200|5601|8086|9092|6379|6380)" | grep LISTEN

# Alternative port check
lsof -i :8080,9200,5601,8086,9092,6379,6380

# Docker service logs analysis
services=("nginx" "elasticsearch" "kafka" "influxdb" "realtime-processor")
for service in "${services[@]}"; do
  echo "=== $service logs ==="
  docker-compose logs --tail=20 $service
  echo ""
done

# Container restart with dependency order
docker-compose restart kafka
sleep 10
docker-compose restart elasticsearch  
sleep 10
docker-compose restart realtime-processor
```

#### Log Collection Issues
```bash
# Filebeat diagnostic
echo "=== Filebeat Diagnostics ==="
docker logs waf-filebeat --tail=50

# ModSecurity log file verification
echo "=== ModSecurity Log Files ==="
docker exec -it waf-nginx find /var/log/modsecurity -name "*.json" -exec ls -la {} \;

# Fluent Bit configuration validation
echo "=== Fluent Bit Configuration ==="
docker exec -it waf-fluent-bit /fluent-bit/bin/fluent-bit --dry-run \
  -c /fluent-bit/etc/fluent-bit.conf

# Log file permissions check
docker exec -it waf-nginx ls -la /var/log/modsecurity/
```

#### Real-time Processing Issues  
```bash
# Redis Streams connectivity
echo "=== Redis Streams Health Check ==="
docker exec -it waf-redis-streams redis-cli ping
docker exec -it waf-redis-streams redis-cli INFO replication

# InfluxDB connection verification
echo "=== InfluxDB Connectivity ==="
curl -v http://localhost:8086/ping 2>&1 | grep -E "(HTTP|Connected)"

# Real-time processor detailed logs
echo "=== Real-time Processor Diagnostics ==="
docker logs waf-realtime-processor --timestamps 2>&1 | tail -50

# Go service health check
docker exec -it waf-realtime-processor ps aux
docker-compose restart realtime-processor
```

### 8.2 Advanced Debugging

#### Log Level Configuration
```bash
# Enable debug logging for Nginx
docker exec -it waf-nginx sed -i 's/error_log.*$/error_log \/var\/log\/nginx\/error.log debug;/' /etc/nginx/nginx.conf
docker-compose restart nginx

# Logstash debug mode
docker-compose exec logstash bin/logstash --path.settings /usr/share/logstash/config --log.level debug

# Increase ModSecurity verbosity
docker exec -it waf-nginx sed -i 's/SecAuditLogParts.*/SecAuditLogParts ABIJDEFHZ/' /etc/modsecurity/modsecurity.conf
docker-compose restart nginx
```

#### Database Cleanup and Reset
```bash
# Elasticsearch index cleanup
echo "=== Cleaning Elasticsearch Indices ==="
curl -X DELETE "http://localhost:9200/waf-*"
curl -X DELETE "http://localhost:9200/.security*"

# InfluxDB database reset
echo "=== Resetting InfluxDB ==="
curl -X POST "http://localhost:8086/query" \
  --data-urlencode "q=DROP DATABASE waf_realtime"
curl -X POST "http://localhost:8086/query" \
  --data-urlencode "q=CREATE DATABASE waf_realtime"

# Redis data cleanup
docker exec -it waf-redis-streams redis-cli FLUSHALL
docker exec -it waf-redis redis-cli FLUSHALL

# Complete system reset
echo "=== Complete System Reset ==="
docker-compose down -v --remove-orphans
docker system prune -f
docker volume prune -f
docker-compose up -d
```

---

## 9. Enterprise Considerations

### 9.1 Production Deployment Checklist

#### Security Hardening
- [ ] **TLS/SSL Configuration**: Enable HTTPS with proper certificates
- [ ] **Authentication**: Implement proper authentication for all services  
- [ ] **Network Segmentation**: Configure proper firewall rules and VLANs
- [ ] **Secret Management**: Use external secret management (HashiCorp Vault, etc.)
- [ ] **Access Control**: Implement RBAC for Kibana and other management interfaces

#### Scalability Planning
- [ ] **Horizontal Scaling**: Configure container orchestration (Kubernetes/OpenShift)
- [ ] **Load Balancing**: Implement proper load balancing with health checks
- [ ] **Auto-scaling**: Configure auto-scaling based on metrics
- [ ] **Resource Limits**: Set appropriate CPU/memory limits and requests
- [ ] **Storage Planning**: Plan for log retention and archival strategies

#### Monitoring & Alerting
- [ ] **APM Integration**: Integrate with application performance monitoring
- [ ] **SLA Monitoring**: Monitor SLA compliance and response times
- [ ] **Capacity Planning**: Monitor resource utilization trends
- [ ] **Alert Fatigue Prevention**: Implement intelligent alert routing
- [ ] **Incident Response**: Integrate with incident management systems

### 9.2 Compliance & Audit Requirements
```bash
# Generate compliance reports
echo "=== Security Event Summary Report ==="
curl -s "http://localhost:9200/waf-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 0,
    "query": {
      "range": {
        "@timestamp": {
          "gte": "now-24h"
        }
      }
    },
    "aggs": {
      "security_events_by_hour": {
        "date_histogram": {
          "field": "@timestamp",
          "fixed_interval": "1h"
        }
      },
      "top_blocked_ips": {
        "terms": {
          "field": "transaction.client_ip.keyword",
          "size": 20
        }
      }
    }
  }' | jq '.aggregations'

# Audit log export
curl -s "http://localhost:9200/waf-logs-*/_search?scroll=1m&size=1000" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "range": {
        "@timestamp": {
          "gte": "now-7d"
        }
      }
    }
  }' > audit_export.json
```

### 9.3 Performance Baselines

| Metric | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Requests/sec** | 100 | 1,000 | 10,000+ |
| **Response Time (P95)** | < 200ms | < 100ms | < 50ms |
| **Memory Usage** | < 4GB | < 16GB | < 64GB |
| **CPU Usage** | < 50% | < 70% | < 80% |
| **Alert Response** | < 30s | < 10s | < 5s |

---

## 📊 Expected Test Results

### Success Criteria
- **Attack Detection Rate**: ≥ 99.5% (Known attack patterns)
- **False Positive Rate**: ≤ 0.1% (Legitimate traffic)
- **Real-time Alert Latency**: ≤ 5 seconds (High-severity attacks)
- **Log Segregation Accuracy**: ≥ 98% (Scanner vs. legitimate attacks)
- **System Availability**: ≥ 99.9% (Uptime)

### Performance Benchmarks
- **Throughput**: ≥ 1,000 requests/sec (Mixed traffic)
- **Memory Footprint**: ≤ 4GB total (All services)
- **Disk I/O**: ≤ 500MB/sec (Log storage)
- **Network I/O**: ≤ 1GB/sec (Inter-service communication)

---

## 🔧 Advanced Testing Scenarios

### Integration Testing with External Tools
```bash
# OWASP ZAP Integration
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:8080 \
  -J zap-report.json

# Burp Suite Professional Integration
# Configure Burp to proxy through localhost:8080
# Run automated scans against the WAF

# Custom payload testing
curl -X POST "http://localhost:8080/api/test" \
  -H "Content-Type: application/json" \
  -d @custom_payloads.json
```

### Chaos Engineering
```bash
# Simulate service failures
docker-compose stop elasticsearch
sleep 60
docker-compose start elasticsearch

# Network latency simulation
tc qdisc add dev eth0 root netem delay 100ms 20ms

# Memory pressure simulation
stress-ng --vm 2 --vm-bytes 1G --timeout 60s
```

---

## 📞 Enterprise Support

For enterprise deployments, ensure you have:

1. **24/7 Monitoring**: Implement comprehensive monitoring and alerting
2. **Disaster Recovery**: Plan for backup and disaster recovery procedures
3. **Documentation**: Maintain up-to-date runbooks and procedures
4. **Training**: Train operations team on system management
5. **Vendor Support**: Establish support contracts for critical components

---

**🎯 Enterprise Deployment Complete?**

Document your results in `docs/TEST/ENTERPRISE_RESULTS.md` and maintain a changelog for future reference.