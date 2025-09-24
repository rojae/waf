#!/bin/bash

# WAF 시스템 상태 확인 스크립트
echo "📊 WAF 시스템 상태 확인"
echo "===================="

echo ""
echo "🏗️  네임스페이스별 Pod 상태:"
echo "----------------------------"
for ns in waf-system waf-data waf-processing waf-monitoring; do
    echo "[$ns]"
    kubectl get pods -n $ns --no-headers | awk '{printf "  %-30s %s\n", $1, $3}'
    echo ""
done

echo "🔗 서비스 상태:"
echo "---------------"
echo "포트포워딩 프로세스 수: $(pgrep -f 'kubectl port-forward' | wc -l)"
echo ""

echo "🌐 접속 가능한 URL들:"
echo "--------------------"
services=(
    "3001:WAF Frontend"
    "8080:WAF (Nginx)"
    "8082:Dashboard API"
    "8081:Social API"
    "3000:Grafana"
    "5601:Kibana"
    "8086:InfluxDB"
    "9200:Elasticsearch"
    "8123:ClickHouse"
    "9092:Kafka"
    "8088:ksqlDB"
    "2020:Fluent Bit"
)

for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service##*:}"
    if lsof -i :$port > /dev/null 2>&1; then
        echo "  ✅ $name: http://localhost:$port"
    else
        echo "  ❌ $name: 포트 $port 사용 불가"
    fi
done

echo ""
echo "🧪 테스트 명령어:"
echo "----------------"
echo "curl \"http://localhost:8080/search?q=<script>alert('xss')</script>\""