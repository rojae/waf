#!/bin/bash

# WAF Dashboard 스타트업 스크립트
set -e

echo "🛡️ Starting WAF Dashboard System..."

# 환경 변수 확인
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Creating from example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your Google OAuth credentials"
    echo "   GOOGLE_CLIENT_ID=your-client-id"
    echo "   GOOGLE_CLIENT_SECRET=your-client-secret"
    exit 1
fi

echo "✅ Environment file found"

# 필수 서비스부터 단계적 시작
echo "🚀 Phase 1: Starting core infrastructure..."
docker-compose up -d redis elasticsearch influxdb

echo "⏳ Waiting for services to be ready..."
sleep 30

echo "🚀 Phase 2: Starting WAF applications..."
docker-compose up -d waf-dashboard-api waf-social-api

echo "⏳ Waiting for backend services..."
sleep 20

echo "🚀 Phase 3: Starting frontend..."
docker-compose up -d waf-frontend

echo "⏳ Waiting for frontend to start..."
sleep 15

echo "🚀 Phase 4: Starting monitoring stack..."
docker-compose up -d grafana nginx fluent-bit

echo "✅ WAF Dashboard System Started!"
echo ""
echo "📊 Access Points:"
echo "   • WAF Dashboard:  http://localhost:3001"
echo "   • Grafana:        http://localhost:3000 (admin/admin)"
echo "   • Kibana:         http://localhost:5601"  
echo "   • WAF Nginx:      http://localhost:8080"
echo ""
echo "🔧 API Endpoints:"
echo "   • Dashboard API:  http://localhost:8082"
echo "   • Social API:     http://localhost:8081"
echo ""
echo "📋 Service Status:"
docker-compose ps | grep -E "(waf-|redis|elasticsearch|influxdb|grafana)"
echo ""
echo "📝 Next Steps:"
echo "   1. Configure Google OAuth in .env file"
echo "   2. Access http://localhost:3001 and sign in"
echo "   3. Create custom WAF rules in the dashboard"
echo ""