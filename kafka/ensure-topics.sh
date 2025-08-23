#!/bin/sh
# ensure-topics.sh
# Usage:
#   chmod +x ensure-topics.sh
#   ./ensure-topics.sh
#   # or override container/broker:
#   CONTAINER=waf-kafka BROKER=localhost:9092 ./ensure-topics.sh

set -eu

CONTAINER="${CONTAINER:-waf-kafka}"
BROKER="${BROKER:-localhost:9092}"

has_if_not_exists() {
  docker exec "$CONTAINER" kafka-topics --help 2>&1 | grep -q -- "--if-not-exists" || return 1
}

topic_exists() {
  # return 0 if topic exists, 1 otherwise
  docker exec "$CONTAINER" kafka-topics --bootstrap-server "$BROKER" --list \
    | tr -d '\r' | awk -v t="$1" '$0==t{found=1} END{exit !found}'
}

create_topic() {
  topic="$1"; partitions="$2"; rf="$3"; shift 3
  CONFIG_ARGS=""
  for cfg in "$@"; do
    CONFIG_ARGS="$CONFIG_ARGS --config $cfg"
  done

  # Try with --if-not-exists if available; otherwise do existence check first
  if has_if_not_exists; then
    echo "Ensuring topic '$topic' (with --if-not-exists)"
    docker exec "$CONTAINER" sh -lc \
      "kafka-topics --bootstrap-server '$BROKER' \
        --create --if-not-exists \
        --topic '$topic' \
        --partitions $partitions \
        --replication-factor $rf $CONFIG_ARGS"
  else
    if topic_exists "$topic"; then
      echo "Topic '$topic' already exists. Skipping."
    else
      echo "Creating topic '$topic'"
      docker exec "$CONTAINER" sh -lc \
        "kafka-topics --bootstrap-server '$BROKER' \
          --create \
          --topic '$topic' \
          --partitions $partitions \
          --replication-factor $rf $CONFIG_ARGS"
    fi
  fi

  # Show the result (ignore errors just in case)
  docker exec "$CONTAINER" kafka-topics --bootstrap-server "$BROKER" --describe --topic "$topic" 2>/dev/null || true
  echo "----"
}

# ===== Analytics Track Topics =====
create_topic "waf-logs"             6 1  # 분석용 로그 (스캐너 포함)
create_topic "waf-modsec-raw"       6 1  # ksqlDB 처리용  
create_topic "waf-modsec-enriched"  6 1  # 룰맵 조인된 데이터
create_topic "waf-modsec-metrics"   3 1  # 집계 메트릭

# ===== Real-time Track (Redis Streams 사용) =====
# Redis Streams: waf-realtime-events

# ===== Lookup Tables =====
create_topic "waf-rulemap"          6 1 "cleanup.policy=compact"  # 룰 메타데이터

# ===== Archive & Backup =====
create_topic "waf-archive"          3 1 "retention.ms=2592000000"  # 30일 보존