#!/bin/bash

# quit when error
set -e

echo "🚀 Starting WAF Dual-Track Architecture..."

# Set permissions
echo "📋 Setting file permissions..."
chmod 644 "./filebeat/filebeat.yml"
chmod 644 "./fluent-bit/fluent-bit.conf"
chmod 644 "./fluent-bit/realtime_filter.lua"
chmod 644 "./fluent-bit/parsers.conf"
chmod 644 "./ksqldb/ddl.sql" 
chmod 644 "./ksqldb/rulemap-init.sql"
chmod 644 "./clickhouse/init.sql"

# Create directories if not exist
echo "📁 Creating required directories..."
mkdir -p ./services/realtime-processor
mkdir -p ./fluent-bit
mkdir -p ./clickhouse

# Validate configuration files
echo "✅ Validating configurations..."
if [ ! -f "./fluent-bit/fluent-bit.conf" ]; then
    echo "❌ Fluent Bit configuration not found!"
    exit 1
fi

if [ ! -f "./services/realtime-processor/Dockerfile" ]; then
    echo "❌ Real-time processor Dockerfile not found!"
    exit 1
fi

echo "🔨 Building services..."
docker-compose build --no-cache

echo "🌟 Starting dual-track WAF system..."
echo "  📊 Analytics Track: ELK + ksqlDB"  
echo "  ⚡ Real-time Track: Redis Streams + InfluxDB"
echo "  🔍 Scanner Detection: Separate indexing"
echo "  📈 OLAP Analytics: ClickHouse"

docker-compose up
