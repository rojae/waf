#!/bin/bash
# =============================================
# Kubernetes Port Forwarding Script
# =============================================
# Starts all port forwards in background
# =============================================

# Kill existing port forwards
echo "Killing existing kubectl port-forward processes..."
pkill -f "kubectl port-forward" || true

echo "Starting port forwards..."

# Frontend
kubectl port-forward -n waf-system service/waf-frontend 3001:3001 &
echo "✓ Frontend: http://localhost:3001"

# Backend APIs
kubectl port-forward -n waf-system service/waf-social-api 8081:8081 &
echo "✓ Social API: http://localhost:8081"

kubectl port-forward -n waf-system service/waf-dashboard-api 8082:8082 &
echo "✓ Dashboard API: http://localhost:8082"

# NGINX WAF
kubectl port-forward -n waf-system service/nginx-waf-service 8080:80 &
echo "✓ NGINX WAF: http://localhost:8080"

# Data Services
kubectl port-forward -n waf-data service/influxdb 8086:8086 &
echo "✓ InfluxDB: http://localhost:8086"

kubectl port-forward -n waf-data service/elasticsearch 9200:9200 &
echo "✓ Elasticsearch: http://localhost:9200"

kubectl port-forward -n waf-data service/clickhouse 8123:8123 &
echo "✓ ClickHouse: http://localhost:8123"

# Processing Services
kubectl port-forward -n waf-processing service/kafka 9092:9092 &
echo "✓ Kafka: localhost:9092"

kubectl port-forward -n waf-processing service/ksqldb 8088:8088 &
echo "✓ ksqlDB: http://localhost:8088"

echo ""
echo "All port forwards started in background."
echo ""
echo "To stop all port forwards, run:"
echo "  pkill -f 'kubectl port-forward'"
echo ""
echo "To see running port forwards:"
echo "  ps aux | grep 'kubectl port-forward'"
