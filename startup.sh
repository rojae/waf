#!/bin/bash

# WAF 전체 시스템 스타트업 스크립트
set -e

echo "🛡️ Starting WAF Dual-Track Architecture System..."

# 환경 변수 확인
echo "📋 Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo "# WAF System Environment Variables" > .env
        echo "GOOGLE_CLIENT_ID=your-google-client-id" >> .env
        echo "GOOGLE_CLIENT_SECRET=your-google-client-secret" >> .env
        echo "JWT_SECRET=change-me-to-32-bytes-secret-key" >> .env
        echo "INFLUXDB_TOKEN=your-secure-influxdb-token" >> .env
    fi
    echo "📝 Please edit .env file with your credentials:"
    echo "   • GOOGLE_CLIENT_ID: Google OAuth Client ID"
    echo "   • GOOGLE_CLIENT_SECRET: Google OAuth Client Secret"
    echo "   • JWT_SECRET: 32-byte secret key for JWT"
    echo "   • INFLUXDB_TOKEN: InfluxDB authentication token"
    exit 1
fi

echo "✅ Environment file found"

# 파일 권한 설정
echo "📋 Setting file permissions..."
[ -f "./fluent-bit/fluent-bit.conf" ] && chmod 644 "./fluent-bit/fluent-bit.conf"
[ -f "./fluent-bit/parsers.conf" ] && chmod 644 "./fluent-bit/parsers.conf"
[ -f "./fluent-bit/waf_classifier.lua" ] && chmod 644 "./fluent-bit/waf_classifier.lua"
[ -f "./ksqldb/ddl.sql" ] && chmod 644 "./ksqldb/ddl.sql"
[ -f "./clickhouse/init.sql" ] && chmod 644 "./clickhouse/init.sql"

# 필수 디렉토리 생성
echo "📁 Creating required directories..."
mkdir -p ./services/realtime-processor
mkdir -p ./services/alert-processor
mkdir -p ./fluent-bit
mkdir -p ./ksqldb
mkdir -p ./clickhouse
mkdir -p ./logstash/pipeline

# 빌드 옵션 확인
BUILD_OPTION=""
if [ "$1" = "--build" ] || [ "$1" = "-b" ]; then
    echo "🔨 Building all services (this may take a few minutes)..."
    BUILD_OPTION="--build"
elif [ "$1" = "--build-backend" ]; then
    echo "🔨 Building backend services only..."
    docker compose build waf-dashboard-api waf-social-api
elif [ "$1" = "--build-frontend" ]; then
    echo "🔨 Building frontend only..."
    docker compose build waf-frontend
fi

# 단계적 서비스 시작
echo "🚀 Phase 1: Starting core infrastructure (Storage & Message Queue)..."
docker compose up $BUILD_OPTION -d kafka elasticsearch influxdb clickhouse

echo "✅ Kafka topic ensure check..."
sh ./kafka/ensure-topics.sh

echo "⏳ Waiting for core services to initialize..."
sleep 30

echo "🚀 Phase 2: Starting stream processing..."
docker compose up $BUILD_OPTION -d ksqldb logstash

echo "⏳ Waiting for stream processors..."
sleep 20

echo "🚀 Phase 3: Starting WAF applications..."
docker compose up $BUILD_OPTION -d waf-dashboard-api waf-social-api

echo "⏳ Waiting for backend APIs..."
sleep 15

echo "🚀 Phase 4: Starting frontend and processors..."
docker compose up $BUILD_OPTION -d waf-frontend realtime-processor alert-processor

echo "⏳ Waiting for frontend to start..."
sleep 10

echo "🚀 Phase 5: Starting monitoring and WAF core..."
docker compose up $BUILD_OPTION -d grafana kibana nginx fluent-bit

echo "⏳ Final initialization..."
sleep 15

echo ""
echo "✅ WAF Dual-Track System Started Successfully!"
echo ""
echo "🌟 System Architecture:"
echo "  📊 Analytics Track: Kafka → ksqlDB → Elasticsearch/ClickHouse"
echo "  ⚡ Real-time Track: Redis Streams → Go Processor → InfluxDB"
echo "  🔍 Threat Detection: ModSecurity → Fluent Bit → Dual Routing"
echo "  🛡️ WAF Protection: Nginx + OWASP CRS"
echo ""
echo "📊 Access Points:"
echo "   • WAF Dashboard:     http://localhost:3001"
echo "   • WAF Protection:    http://localhost:8080"
echo "   • Grafana:           http://localhost:3000 (admin/admin)"
echo "   • Kibana:            http://localhost:5601"
echo "   • Elasticsearch:     http://localhost:9200"
echo "   • InfluxDB:          http://localhost:8086"
echo ""
echo "🔧 API Endpoints:"
echo "   • Dashboard API:     http://localhost:8082"
echo "   • Social Auth API:   http://localhost:8081"
echo "   • ksqlDB:            http://localhost:8088"
echo ""
echo "📋 Service Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | head -20
echo ""
echo "📝 Next Steps:"
echo "   1. Test WAF protection: curl http://localhost:8080"
echo "   2. Generate attacks: curl \"http://localhost:8080/?id=<script>alert(1)</script>\""
echo "   3. Access dashboard: http://localhost:3001"
echo "   4. Monitor real-time: http://localhost:3000"
echo "   5. Analyze logs: http://localhost:5601"
echo ""
echo "🎯 Attack Testing Examples:"
echo "   • XSS: curl \"http://localhost:8080/search?q=<script>alert('xss')</script>\""
echo "   • SQLi: curl -d \"user=admin' OR 1=1--\" http://localhost:8080/login"
echo "   • Scanner: curl -H \"User-Agent: Nikto\" http://localhost:8080"
echo ""
echo "💡 Usage Options:"
echo "   • ./startup.sh              : Start with existing images"
echo "   • ./startup.sh --build      : Build all services and start"
echo "   • ./startup.sh -b           : Same as --build"
echo "   • ./startup.sh --build-backend : Build only backend services"
echo "   • ./startup.sh --build-frontend: Build only frontend service"
echo ""
