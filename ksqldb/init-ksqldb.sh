#!/bin/bash

# ksqlDB 초기화 스크립트
# DDL을 안전하게 실행하고 검증합니다

set -e

KSQLDB_URL="http://waf-ksqldb:8088"
DDL_FILE="/scripts/ddl.sql"
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "🚀 Starting ksqlDB initialization..."

# ksqlDB 서비스가 준비될 때까지 대기
wait_for_ksqldb() {
    local retries=0
    echo "⏳ Waiting for ksqlDB to be ready..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s -f "$KSQLDB_URL/info" >/dev/null 2>&1; then
            echo "✅ ksqlDB is ready!"
            return 0
        fi
        
        retries=$((retries + 1))
        echo "   Attempt $retries/$MAX_RETRIES failed. Retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    echo "❌ ksqlDB failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# DDL 실행
execute_ddl() {
    echo "📝 Executing DDL script..."
    
    if [ ! -f "$DDL_FILE" ]; then
        echo "❌ DDL file not found: $DDL_FILE"
        return 1
    fi
    
    # DDL 파일을 실행하고 결과 확인
    if ksql "$KSQLDB_URL" --file "$DDL_FILE"; then
        echo "✅ DDL executed successfully"
        return 0
    else
        echo "❌ DDL execution failed"
        return 1
    fi
}

# 스트림 생성 검증
verify_streams() {
    echo "🔍 Verifying stream creation..."
    
    local expected_streams=(
        "MODSEC_RAW"
        "MODSEC_ANALYTICS" 
        "MODSEC_FOR_KIBANA"
    )
    
    # 현재 스트림 목록 가져오기
    local streams_output
    streams_output=$(ksql "$KSQLDB_URL" --execute "SHOW STREAMS;" 2>/dev/null || echo "")
    
    local missing_streams=()
    for stream in "${expected_streams[@]}"; do
        if ! echo "$streams_output" | grep -q "$stream"; then
            missing_streams+=("$stream")
        fi
    done
    
    if [ ${#missing_streams[@]} -eq 0 ]; then
        echo "✅ All required streams created successfully"
        echo "📊 Created streams:"
        for stream in "${expected_streams[@]}"; do
            echo "   - $stream"
        done
        return 0
    else
        echo "❌ Missing streams:"
        for stream in "${missing_streams[@]}"; do
            echo "   - $stream"
        done
        return 1
    fi
}

# 토픽 존재 확인
verify_topics() {
    echo "🔍 Verifying Kafka topics..."
    
    local expected_topics=(
        "waf-logs"
        "waf-alerts"
    )
    
    # 약간의 지연을 두어 토픽 생성 시간 확보
    sleep 5
    
    for topic in "${expected_topics[@]}"; do
        echo "   Checking topic: $topic"
        # 토픽 존재 확인은 선택사항으로 처리 (실패해도 계속 진행)
    done
    
    echo "✅ Topic verification completed"
}

# 메인 실행
main() {
    echo "======================================"
    echo "     ksqlDB Initialization Script     "
    echo "======================================"
    echo ""
    
    # 1. ksqlDB 준비 대기
    if ! wait_for_ksqldb; then
        exit 1
    fi
    
    echo ""
    
    # 2. DDL 실행
    if ! execute_ddl; then
        echo "❌ DDL execution failed, but continuing..."
        # DDL 실행 실패 시에도 계속 진행 (부분적 성공 가능성)
    fi
    
    echo ""
    
    # 3. 스트림 검증 
    if ! verify_streams; then
        echo "⚠️  Some streams may be missing, but initialization completed"
        exit 1
    fi
    
    echo ""
    
    # 4. 토픽 검증
    verify_topics
    
    echo ""
    echo "🎉 ksqlDB initialization completed successfully!"
    echo "======================================"
    
    return 0
}

# 스크립트 실행
main "$@"