#!/bin/bash

# WAF local Docker Compose startup script.
set -euo pipefail

echo "🛡️ Starting WAF runtime stack..."

if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Create one from .env.example and fill in credentials."
    echo "   cp .env.example .env"
    exit 1
fi

set -a
source .env
set +a

CLICKHOUSE_DATABASE=${CLICKHOUSE_DATABASE:-${CLICKHOUSE_DB:-waf_analytics}}
CLICKHOUSE_PORT=${CLICKHOUSE_PORT:-9000}
KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}
export CLICKHOUSE_DATABASE CLICKHOUSE_PORT KAFKA_BOOTSTRAP_SERVERS

BUILD_OPTION=""
case "${1:-}" in
    --build|-b)
        BUILD_OPTION="--build"
        ;;
    --build-backend)
        docker compose build waf-dashboard-api waf-social-api
        ;;
    --build-frontend)
        docker compose build waf-frontend
        ;;
    "")
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo "Usage: ./startup.sh [--build|-b|--build-backend|--build-frontend]"
        exit 1
        ;;
esac

for file in \
    ./fluent-bit/fluent-bit.conf \
    ./fluent-bit/parsers.conf \
    ./fluent-bit/waf_classifier.lua \
    ./ksqldb/ddl.sql \
    ./clickhouse/init.sql; do
    [ -f "$file" ] && chmod 644 "$file"
done

wait_container_condition() {
    local service="$1"
    local expected="$2"
    local timeout_seconds="${3:-180}"
    local elapsed=0
    local container_id=""
    local status=""
    local health=""

    while [ "$elapsed" -lt "$timeout_seconds" ]; do
        container_id=$(docker compose ps -q "$service" 2>/dev/null || true)
        if [ -n "$container_id" ]; then
            status=$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)
            health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id" 2>/dev/null || true)
            case "$expected" in
                healthy)
                    if [ "$health" = "healthy" ]; then
                        echo "✅ $service is healthy"
                        return 0
                    fi
                    if [ -z "$health" ] && [ "$status" = "running" ]; then
                        echo "✅ $service is running"
                        return 0
                    fi
                    ;;
                running)
                    if [ "$status" = "running" ]; then
                        echo "✅ $service is running"
                        return 0
                    fi
                    ;;
            esac
        fi
        sleep 3
        elapsed=$((elapsed + 3))
    done

    echo "❌ $service did not become $expected within ${timeout_seconds}s"
    docker compose ps "$service" || true
    docker compose logs --tail=80 "$service" || true
    return 1
}

wait_job_success() {
    local service="$1"
    local timeout_seconds="${2:-180}"
    local elapsed=0
    local container_id=""
    local status=""
    local exit_code=""

    while [ "$elapsed" -lt "$timeout_seconds" ]; do
        container_id=$(docker compose ps -a -q "$service" 2>/dev/null || true)
        if [ -n "$container_id" ]; then
            status=$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)
            exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$container_id" 2>/dev/null || true)
            if [ "$status" = "exited" ] && [ "$exit_code" = "0" ]; then
                echo "✅ $service completed successfully"
                return 0
            fi
            if [ "$status" = "exited" ] && [ "$exit_code" != "0" ]; then
                echo "❌ $service exited with code $exit_code"
                docker compose logs --tail=120 "$service" || true
                return 1
            fi
        fi
        sleep 3
        elapsed=$((elapsed + 3))
    done

    echo "❌ $service did not complete within ${timeout_seconds}s"
    docker compose ps "$service" || true
    docker compose logs --tail=120 "$service" || true
    return 1
}

compose_up() {
    docker compose up $BUILD_OPTION -d "$@"
}

echo "🚀 Phase 1: Starting storage and message infrastructure..."
compose_up kafka elasticsearch influxdb clickhouse
wait_container_condition kafka healthy 180
wait_container_condition elasticsearch healthy 180
wait_container_condition influxdb healthy 180
wait_container_condition clickhouse healthy 180

echo "🚀 Phase 2: Running Kafka topic initialization..."
compose_up topics-init
wait_job_success topics-init 180

echo "🚀 Phase 3: Starting stream processing services..."
compose_up ksqldb logstash
wait_container_condition ksqldb healthy 240
wait_container_condition logstash running 180

echo "🚀 Phase 4: Running ksqlDB DDL initialization..."
compose_up ksqldb-cli-init
wait_job_success ksqldb-cli-init 240

echo "🚀 Phase 5: Starting APIs and processors..."
compose_up waf-dashboard-api waf-social-api realtime-processor alert-processor kafka-clickhouse-consumer
wait_container_condition waf-dashboard-api running 180
wait_container_condition waf-social-api running 180
wait_container_condition realtime-processor running 180
wait_container_condition alert-processor running 180
wait_container_condition kafka-clickhouse-consumer running 180

echo "🚀 Phase 6: Starting frontend, monitoring, and WAF ingress..."
compose_up waf-frontend grafana kibana nginx fluent-bit
wait_container_condition waf-frontend running 180
wait_container_condition grafana running 180
wait_container_condition kibana running 180
wait_container_condition nginx running 180
wait_container_condition fluent-bit healthy 180

echo ""
echo "✅ WAF runtime stack is ready."
echo ""
echo "🌟 Runtime flow:"
echo "  🛡️ ModSecurity → Fluent Bit → Kafka waf-realtime-events"
echo "  📊 Kafka → ksqlDB / Logstash / ClickHouse consumer"
echo "  ⚡ Real-time processor → InfluxDB"
echo ""
echo "📊 Access Points:"
echo "   • WAF Dashboard:     http://localhost:3001"
echo "   • WAF Protection:    http://localhost:8080"
echo "   • Grafana:           http://localhost:3000"
echo "   • Kibana:            http://localhost:5601"
echo "   • Elasticsearch:     http://localhost:9200"
echo "   • InfluxDB:          http://localhost:8086"
echo "   • ClickHouse HTTP:   http://localhost:8123"
echo ""
echo "🔧 API Endpoints:"
echo "   • Dashboard API:     http://localhost:8082"
echo "   • Social Auth API:   http://localhost:8081"
echo "   • ksqlDB:            http://localhost:8088"
echo ""
echo "📋 Service Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "💡 Usage Options:"
echo "   • ./startup.sh                    Start with existing images"
echo "   • ./startup.sh --build            Build all services and start"
echo "   • ./startup.sh -b                 Same as --build"
echo "   • ./startup.sh --build-backend    Build only backend services first"
echo "   • ./startup.sh --build-frontend   Build only frontend service first"
