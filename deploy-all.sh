#!/bin/bash

# WAF 시스템 전체 배포 스크립트
set -e

# 기본값 설정
ENV_FILE=".env"
CONFIG_MODE="auto"
FORCE_RECREATE=false

# 사용법 표시
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env-file FILE        환경변수 파일 경로 (기본값: .env)"
    echo "  -m, --mode MODE           설정 모드: auto|env|interactive (기본값: auto)"
    echo "  -f, --force               기존 .local 파일 강제 재생성"
    echo "  -h, --help                도움말 표시"
    echo ""
    echo "설정 모드:"
    echo "  auto          .env 파일에서 자동 로드"
    echo "  env           환경변수에서 직접 읽기"
    echo "  interactive   대화형으로 값 입력"
    echo ""
    echo "예시:"
    echo "  $0                                    # 기본 .env 파일 사용"
    echo "  $0 -e .env.prod                       # 프로덕션 환경파일 사용"
    echo "  $0 -m env                             # 환경변수에서 직접 읽기"
    echo "  $0 -m interactive                     # 대화형 입력"
    echo "  DOMAIN=example.com $0 -m env          # 환경변수로 값 전달"
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -m|--mode)
            CONFIG_MODE="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_RECREATE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "❌ 알 수 없는 옵션: $1"
            show_usage
            exit 1
            ;;
    esac
done

echo "🚀 WAF 시스템 전체 배포를 시작합니다..."
echo "   환경파일: $ENV_FILE"
echo "   설정모드: $CONFIG_MODE"

# 환경변수 로드
echo "📋 환경변수 로드 중..."

case $CONFIG_MODE in
    "auto")
        if [ ! -f "$ENV_FILE" ]; then
            echo "❌ 환경파일이 없습니다: $ENV_FILE"
            echo "   .env.example을 복사하여 환경파일을 생성하고 값을 설정해주세요."
            echo "   cp .env.example $ENV_FILE"
            echo "   vi $ENV_FILE"
            exit 1
        fi
        set -a
        source "$ENV_FILE"
        set +a
        echo "   ✅ $ENV_FILE 파일에서 환경변수 로드 완료"
        ;;
    "env")
        echo "   ✅ 시스템 환경변수 사용"
        ;;
    "interactive")
        echo "   📝 대화형 환경변수 입력:"
        read -p "DOMAIN (예: localhost): " DOMAIN
        read -p "OAUTH_CALLBACK_BASE_URL (예: http://localhost:3001): " OAUTH_CALLBACK_BASE_URL
        read -p "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
        read -s -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
        echo
        read -s -p "JWT_SECRET: " JWT_SECRET
        echo
        read -s -p "NEXTAUTH_SECRET: " NEXTAUTH_SECRET
        echo
        read -p "INFLUXDB_TOKEN: " INFLUXDB_TOKEN
        read -p "INFLUXDB_ORG (기본값: waf-org): " INFLUXDB_ORG
        read -p "INFLUXDB_BUCKET (기본값: waf-realtime): " INFLUXDB_BUCKET

        # 기본값 설정
        INFLUXDB_ORG=${INFLUXDB_ORG:-"waf-org"}
        INFLUXDB_BUCKET=${INFLUXDB_BUCKET:-"waf-realtime"}

        export DOMAIN OAUTH_CALLBACK_BASE_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET
        export JWT_SECRET NEXTAUTH_SECRET INFLUXDB_TOKEN INFLUXDB_ORG INFLUXDB_BUCKET
        echo "   ✅ 대화형 입력 완료"
        ;;
    *)
        echo "❌ 잘못된 설정 모드: $CONFIG_MODE"
        show_usage
        exit 1
        ;;
esac

# .local 파일이 있는지 확인하고, 없으면 템플릿에서 생성
echo "🔧 배포용 manifest 파일 준비 중..."

# secrets 파일 처리
if [ ! -f "k8s/02-configmaps-secrets.yaml.local" ] || [ "$FORCE_RECREATE" = true ]; then
    if [ "$FORCE_RECREATE" = true ]; then
        echo "📝 강제 재생성: secrets 파일 생성 중..."
    else
        echo "📝 환경변수를 사용하여 secrets 파일 생성 중..."
    fi

    # Base64 인코딩이 필요한 값들 처리
    GOOGLE_CLIENT_ID_BASE64=$(echo -n "$GOOGLE_CLIENT_ID" | base64)
    GOOGLE_CLIENT_SECRET_BASE64=$(echo -n "$GOOGLE_CLIENT_SECRET" | base64)
    JWT_SECRET_BASE64=$(echo -n "$JWT_SECRET" | base64)
    NEXTAUTH_SECRET_BASE64=$(echo -n "$NEXTAUTH_SECRET" | base64)

    # 템플릿 파일에서 환경변수 치환
    envsubst < k8s/02-configmaps-secrets.yaml > k8s/02-configmaps-secrets.yaml.local
fi

# applications 파일 처리
if [ ! -f "k8s/06-applications.yaml.local" ] || [ "$FORCE_RECREATE" = true ]; then
    if [ "$FORCE_RECREATE" = true ]; then
        echo "📝 강제 재생성: applications 파일 생성 중..."
    else
        echo "📝 환경변수를 사용하여 applications 파일 생성 중..."
    fi
    envsubst < k8s/06-applications.yaml > k8s/06-applications.yaml.local
fi

# K8s 리소스 배포
echo "📦 Kubernetes 리소스 배포 중..."
kubectl apply -f k8s/00-namespaces.yaml
kubectl apply -f k8s/01-storage.yaml
kubectl apply -f k8s/02-configmaps-secrets.yaml.local
kubectl apply -f k8s/03-nginx-waf.yaml
kubectl apply -f k8s/04-data-stores.yaml
kubectl apply -f k8s/05-processing-services.yaml
kubectl apply -f k8s/06-applications.yaml.local
kubectl apply -f k8s/07-monitoring.yaml

echo "⏳ 30초 대기 (Pod 시작 시간)..."
sleep 30

# 포트 포워딩
echo "🔗 포트 포워딩 설정 중..."

# 기존 포트포워딩 프로세스 종료
echo "기존 포트포워딩 프로세스 정리 중..."
pkill -f "kubectl port-forward" || true
sleep 2

# 포트포워딩 시작
kubectl port-forward -n waf-system service/waf-frontend 3001:3001 > /dev/null 2>&1 &
kubectl port-forward -n waf-system service/waf-social-api 8081:8081 > /dev/null 2>&1 &
kubectl port-forward -n waf-system service/waf-dashboard-api 8082:8082 > /dev/null 2>&1 &
kubectl port-forward -n waf-system service/nginx-waf-service 8080:80 > /dev/null 2>&1 &
kubectl port-forward -n waf-data service/influxdb 8086:8086 > /dev/null 2>&1 &
kubectl port-forward -n waf-data service/elasticsearch 9200:9200 > /dev/null 2>&1 &
kubectl port-forward -n waf-data service/elasticsearch 9300:9300 > /dev/null 2>&1 &
kubectl port-forward -n waf-data service/clickhouse 8123:8123 > /dev/null 2>&1 &
kubectl port-forward -n waf-data service/clickhouse 9000:9000 > /dev/null 2>&1 &
kubectl port-forward -n waf-processing service/kafka 9092:9092 > /dev/null 2>&1 &
kubectl port-forward -n waf-processing service/ksqldb 8088:8088 > /dev/null 2>&1 &
kubectl port-forward -n waf-system service/fluent-bit 2020:2020 > /dev/null 2>&1 &
kubectl port-forward -n waf-monitoring service/kibana 5601:5601 > /dev/null 2>&1 &
kubectl port-forward -n waf-monitoring service/grafana 3000:3000 > /dev/null 2>&1 &

echo "⏳ 5초 대기 (포트포워딩 안정화)..."
sleep 5

echo "✅ WAF 시스템 배포 완료!"
echo ""
echo "🌐 접속 가능한 서비스들:"
echo "- 🖥️  WAF Frontend:     http://localhost:3001"
echo "- 🔒 WAF (Nginx):       http://localhost:8080"
echo "- 📊 Dashboard API:     http://localhost:8082"
echo "- 👤 Social API:        http://localhost:8081"
echo "- 📈 Grafana:           http://localhost:3000"
echo "- 🔍 Kibana:            http://localhost:5601"
echo "- 💾 InfluxDB:          http://localhost:8086"
echo "- 🔎 Elasticsearch:     http://localhost:9200"
echo "- 📊 ClickHouse:        http://localhost:8123"
echo "- 📡 Kafka:             localhost:9092"
echo "- 🔧 ksqlDB:            http://localhost:8088"
echo "- 📋 Fluent Bit:        http://localhost:2020"
echo ""
echo "🧪 XSS 테스트 명령어:"
echo "curl \"http://localhost:8080/search?q=<script>alert('xss')</script>\""
echo ""
echo "🛑 포트포워딩 종료: ./stop-portforward.sh"