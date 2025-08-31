#!/usr/bin/env bash
set -euo pipefail

# ===== InfluxDB =====
INFLUXDB_URL="${INFLUXDB_URL:-http://localhost:8086}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-your-token}"
INFLUXDB_ORG="${INFLUXDB_ORG:-waf-org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-waf-realtime}"

# ===== 배치 설정 =====
BATCH_SIZE="${BATCH_SIZE:-100}"     # 한 번에 보낼 라인 수
BATCH_COUNT="${BATCH_COUNT:-10}"    # 배치 횟수  ← 총 1000건(100x10)
SLEEP_SEC="${SLEEP_SEC:-0}"         # 배치 사이 딜레이(초). 폭주 방지용(옵션)

TOTAL=$((BATCH_SIZE * BATCH_COUNT))

# ===== 랜덤 국가/도시/좌표 =====
COUNTRIES=(US AU KR DE JP BR ZA IN RU FR)
CITIES=(MountainView Sydney Seoul Berlin Tokyo RioDeJaneiro CapeTown Mumbai Moscow Paris)
LATS=(37.3861 -33.8688 37.5665 52.5200 35.6762 -22.9068 -33.9249 19.0760 55.7558 48.8566)
LONS=(-122.0839 151.2093 126.9780 13.4050 139.6503 -43.1729 18.4241 72.8777 37.6173 2.3522)

echo "📦 sending $TOTAL rows to $INFLUXDB_URL (batch=$BATCH_SIZE x count=$BATCH_COUNT)"

for ((b=1; b<=BATCH_COUNT; b++)); do
  {
    base_sec=$(date +%s)  # BSD/맥 호환
    for ((i=1; i<=BATCH_SIZE; i++)); do
      idx=$((RANDOM % ${#COUNTRIES[@]}))
      country="${COUNTRIES[$idx]}"
      city="${CITIES[$idx]}"
      lat="${LATS[$idx]}"
      lon="${LONS[$idx]}"

      ip="203.0.$((RANDOM % 255)).$((RANDOM % 255))"
      method=$([ $((RANDOM % 2)) -eq 0 ] && echo "GET" || echo "POST")
      severity_level=$(shuf -e low medium high critical -n1)
      response_code=$(shuf -e 200 401 403 404 500 502 503 -n1)
      anomaly_score=$((RANDOM % 50))
      severity=$((20 + RANDOM % 90))

      # ns 타임스탬프 = (초 * 1e9) + (0~1e9-1 랜덤) + i(중복 방지용 미세 증가)
      ts_ns=$(( base_sec * 1000000000 + (RANDOM % 1000000000) + i ))

      printf "waf_events,client_ip=%s,geo_country=%s,geo_city=%s,method=%s,severity_level=%s response_code=%di,anomaly_score=%di,severity=%di,latitude=%s,longitude=%s %s\n" \
        "$ip" "$country" "$city" "$method" "$severity_level" \
        "$response_code" "$anomaly_score" "$severity" "$lat" "$lon" "$ts_ns"
    done
  } | curl -sS -X POST "$INFLUXDB_URL/api/v2/write?org=$INFLUXDB_ORG&bucket=$INFLUXDB_BUCKET&precision=ns" \
         -H "Authorization: Token $INFLUXDB_TOKEN" \
         --data-binary @- > /dev/null

  sent=$((b * BATCH_SIZE))
  percent=$(( sent * 100 / TOTAL ))
  echo "➡️  batch $b/$BATCH_COUNT (sent $sent / $TOTAL, $percent%%)" >&2
  if (( SLEEP_SEC > 0 )); then sleep "$SLEEP_SEC"; fi
done

echo "🎉 done: $TOTAL rows sent."