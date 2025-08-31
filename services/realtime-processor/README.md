# Real-Time WAF Event Processor

## Overview

The Real-Time WAF Event Processor is a high-performance Go microservice designed to handle critical security events from ModSecurity WAF in real-time. It provides immediate threat analysis, dynamic severity scoring, and automated alerting for enterprise security operations.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Redis Streams │───→│  Event Processor │───→│    InfluxDB     │
│  (waf-realtime) │    │                  │    │  (time-series)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Alerts      │
                       │  (Redis Lists)  │
                       └─────────────────┘
```

## Key Features

### Real-Time Event Processing
- **High Throughput**: Processes events with sub-second latency
- **Fault Tolerance**: Consumer group pattern ensures no message loss
- **Scalability**: Horizontal scaling with multiple processor instances

### Dynamic Threat Scoring
- **OWASP CRS Integration**: Rule-based severity weighting
- **Threat Intelligence**: IP reputation scoring (extensible)
- **Multi-Factor Analysis**: Combines anomaly scores, rule patterns, and contextual data

### Enterprise Monitoring
- **Time-Series Storage**: InfluxDB integration for metrics and dashboards
- **Structured Logging**: JSON-formatted logs for monitoring integration
- **Health Monitoring**: Error tracking and performance metrics

### Alerting System
- **Severity-Based**: Configurable thresholds for alert triggering
- **Multi-Channel**: Ready for integration with PagerDuty, Slack, email
- **Dashboard Integration**: Redis-based alert storage for real-time dashboards

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `INFLUXDB_URL` | InfluxDB server URL | `http://localhost:8086` |
| `INFLUXDB_TOKEN` | InfluxDB authentication token | `admin-token-change-me` |
| `INFLUXDB_ORG` | InfluxDB organization name | `waf-org` |
| `INFLUXDB_BUCKET` | InfluxDB bucket for metrics | `waf-realtime` |

### Severity Scoring Algorithm

The processor uses a multi-factor scoring system:

**Base Score**: ModSecurity anomaly score (0-100+)

**Rule Category Weights**:
- SQL Injection (942xxx): +30 points
- Cross-Site Scripting (941xxx): +25 points
- Remote Code Execution (932xxx): +35 points
- Local File Inclusion (930xxx): +20 points

**IP Reputation**: +15 points for known malicious IPs

**Severity Levels**:
- **Critical (80+)**: Immediate response required, triggers alerts
- **High (60-79)**: Priority investigation needed
- **Medium (40-59)**: Standard security review
- **Low (0-39)**: Routine monitoring

## Data Flow

### Input: Redis Streams
```json
{
  "transaction": {
    "id": "tx-123456",
    "client_ip": "192.168.1.100",
    "anomaly_score": 65,
    "request": {
      "uri": "/admin/login",
      "method": "POST"
    },
    "messages": [
      {
        "details": {
          "ruleId": "942100",
          "msg": "SQL Injection Attack Detected"
        }
      }
    ]
  },
  "classification": {
    "track": "realtime",
    "rule_id": "942100"
  }
}
```

### Output: InfluxDB Metrics
```
waf_events,client_ip=192.168.1.100,rule_id=942100,severity_level=critical 
  anomaly_score=65,severity=95,response_code=403 
  1640995200000000000
```

### Alerts: Redis Lists
```json
{
  "timestamp": 1640995200,
  "severity": 95,
  "client_ip": "192.168.1.100",
  "rule_id": "942100",
  "uri": "/admin/login",
  "tx_id": "tx-123456"
}
```

## Deployment

### Docker Build
```bash
cd services/realtime-processor
docker build -t waf-realtime-processor .
```

### Local Development
```bash
# Install dependencies
go mod tidy

# Run locally
go run cmd/main.go
```

### Production Deployment
```yaml
# docker-compose.yml
realtime-processor:
  build: ./services/realtime-processor
  environment:
    - REDIS_URL=redis://redis-streams:6379
    - INFLUXDB_URL=http://influxdb:8086
    - INFLUXDB_TOKEN=${INFLUXDB_TOKEN}
  restart: unless-stopped
  depends_on:
    redis-streams:
      condition: service_healthy
    influxdb:
      condition: service_healthy
```

## Monitoring

### Key Metrics
- **Events Processed**: Counter of total processed events
- **Processing Latency**: Time from event receipt to completion
- **Severity Distribution**: Histogram of severity scores
- **Alert Rate**: Rate of critical alerts triggered

### Health Checks
- Redis connectivity status
- InfluxDB write success rate
- Consumer group lag monitoring
- Memory and CPU utilization

### Logging
All logs are structured JSON format compatible with ELK stack:
```json
{
  "level": "info",
  "tx_id": "tx-123456",
  "client_ip": "192.168.1.100",
  "severity": 95,
  "rule_id": "942100",
  "msg": "Processed real-time event",
  "timestamp": "2023-12-31T12:00:00Z"
}
```

## Security Considerations

### Data Privacy
- IP address masking available for GDPR compliance
- Sensitive data filtering before storage
- Configurable data retention policies

### Access Control
- InfluxDB token-based authentication
- Redis AUTH support for secure deployments
- Network isolation in container environments

### High Availability
- Stateless service design for horizontal scaling
- Consumer group failover for Redis Streams
- Circuit breaker patterns for external dependencies

## Troubleshooting

### Common Issues

**High Memory Usage**
- Check InfluxDB batch size configuration
- Monitor Redis Streams consumer group lag
- Verify garbage collection settings

**Connection Timeouts**
- Validate network connectivity to Redis/InfluxDB
- Check authentication credentials
- Review firewall and security group settings

**Missing Alerts**
- Verify severity threshold configuration
- Check Redis list expiration settings
- Monitor InfluxDB write success rate

### Debug Mode
Enable verbose logging with environment variable:
```bash
export LOG_LEVEL=debug
```

## Integration Examples

### Grafana Dashboard Query
```sql
SELECT mean("severity") FROM "waf_events" 
WHERE time >= now() - 1h 
GROUP BY time(1m), "severity_level"
```

### PagerDuty Integration
Extend the `triggerAlert` function:
```go
func (rtp *RealTimeProcessor) triggerAlert(event ModSecurityEvent, severity int) {
    // Existing Redis storage...
    
    // PagerDuty integration
    if severity >= 90 {
        rtp.sendPagerDutyAlert(event, severity)
    }
}
```

## Contributing

### Code Standards
- Follow Go formatting conventions (`go fmt`)
- Add comprehensive documentation for public functions
- Include unit tests for business logic
- Use structured logging throughout

### Testing
```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...
```