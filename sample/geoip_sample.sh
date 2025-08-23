#!/usr/bin/env bash
set -euo pipefail

# InfluxDB 설정 (환경 변수에서 불러오기 권장)
INFLUXDB_URL="${INFLUXDB_URL:-http://localhost:8086}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-your-token}"
INFLUXDB_ORG="${INFLUXDB_ORG:-waf-org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-waf-realtime}"

# 샘플 Line Protocol 데이터 생성
cat <<EOF > ./geoip_sample.lp
waf_events,client_ip=8.8.8.8,geo_country=US,geo_city=MountainView,method=GET,severity_level=low response_code=200i,anomaly_score=5i,severity=10i,latitude=37.3861,longitude=-122.0839 $(date +%s%N)
waf_events,client_ip=1.1.1.1,geo_country=AU,geo_city=Sydney,method=POST,severity_level=medium response_code=403i,anomaly_score=15i,severity=40i,latitude=-33.8688,longitude=151.2093 $(date +%s%N)
waf_events,client_ip=210.89.160.88,geo_country=KR,geo_city=Seoul,method=GET,severity_level=high response_code=500i,anomaly_score=25i,severity=70i,latitude=37.5665,longitude=126.9780 $(date +%s%N)
waf_events,client_ip=91.198.174.192,geo_country=DE,geo_city=Berlin,method=GET,severity_level=critical response_code=502i,anomaly_score=30i,severity=85i,latitude=52.5200,longitude=13.4050 $(date +%s%N)
waf_events,client_ip=203.0.113.10,geo_country=JP,geo_city=Tokyo,method=POST,severity_level=high response_code=404i,anomaly_score=20i,severity=65i,latitude=35.6762,longitude=139.6503 $(date +%s%N)
waf_events,client_ip=186.192.90.5,geo_country=BR,geo_city=RioDeJaneiro,method=GET,severity_level=medium response_code=200i,anomaly_score=10i,severity=45i,latitude=-22.9068,longitude=-43.1729 $(date +%s%N)
waf_events,client_ip=41.77.118.100,geo_country=ZA,geo_city=CapeTown,method=POST,severity_level=low response_code=401i,anomaly_score=8i,severity=20i,latitude=-33.9249,longitude=18.4241 $(date +%s%N)
waf_events,client_ip=58.27.61.100,geo_country=IN,geo_city=Mumbai,method=GET,severity_level=high response_code=403i,anomaly_score=22i,severity=68i,latitude=19.0760,longitude=72.8777 $(date +%s%N)
waf_events,client_ip=213.180.141.140,geo_country=RU,geo_city=Moscow,method=POST,severity_level=critical response_code=503i,anomaly_score=35i,severity=90i,latitude=55.7558,longitude=37.6173 $(date +%s%N)
waf_events,client_ip=62.40.34.50,geo_country=FR,geo_city=Paris,method=GET,severity_level=medium response_code=200i,anomaly_score=12i,severity=50i,latitude=48.8566,longitude=2.3522 $(date +%s%N)
EOF

echo "✅ geoip_sample.lp 생성 완료"

# InfluxDB에 Write
curl -X POST "$INFLUXDB_URL/api/v2/write?org=$INFLUXDB_ORG&bucket=$INFLUXDB_BUCKET&precision=ns" \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-binary @geoip_sample.lp

echo "🎉 샘플 데이터 10개국 InfluxDB 적재 완료"