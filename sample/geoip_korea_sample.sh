#!/usr/bin/env bash
set -euo pipefail

# InfluxDB 설정 (환경 변수에서 불러오기 권장)
INFLUXDB_URL="${INFLUXDB_URL:-http://localhost:8086}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-your-token}"
INFLUXDB_ORG="${INFLUXDB_ORG:-waf-org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-waf-realtime}"

# 한국 전용 데이터
COUNTRY="KR"
CITY="Seoul"
LAT="37.5665"
LON="126.9780"

TOTAL_BATCH=10   # 배치 수 (10번)
BATCH_SIZE=100   # 배치당 개수 (100건)

echo "📦 한국(Seoul) 샘플 데이터 $((TOTAL_BATCH*BATCH_SIZE)) 건 생성 및 업로드 시작..."

for ((b=1; b<=TOTAL_BATCH; b++)); do
  {
    for ((i=1; i<=BATCH_SIZE; i++)); do
      ip="203.0.$((RANDOM % 255)).$((RANDOM % 255))"
      method=$([ $((RANDOM % 2)) -eq 0 ] && echo "GET" || echo "POST")
      severity_level=$(shuf -e low medium high critical -n1)
      response_code=$(shuf -e 200 401 403 404 500 502 503 -n1)
      anomaly_score=$((RANDOM % 50))
      severity=$((20 + RANDOM % 90))
      ts=$(date +%s%N)

      printf "waf_events,client_ip=%s,geo_country=%s,geo_city=%s,method=%s,severity_level=%s response_code=%di,anomaly_score=%di,severity=%di,latitude=%s,longitude=%s %s\n" \
        "$ip" "$COUNTRY" "$CITY" "$method" "$severity_level" \
        "$response_code" "$anomaly_score" "$severity" "$LAT" "$LON" "$ts"
    done
  } | curl -s -X POST "$INFLUXDB_URL/api/v2/write?org=$INFLUXDB_ORG&bucket=$INFLUXDB_BUCKET&precision=ns" \
         -H "Authorization: Token $INFLUXDB_TOKEN" \
         --data-binary @-

  echo "➡️ 배치 $b/$TOTAL_BATCH 완료 (누적 $((b*BATCH_SIZE)) 건)"
done

echo "🎉 한국(Seoul) 샘플 데이터 $((TOTAL_BATCH*BATCH_SIZE)) 건 InfluxDB 적재 완료"
