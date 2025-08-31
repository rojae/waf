#!/usr/bin/env sh
# create-all-kafka-topics.sh
# Usage:
#   chmod +x create-all-kafka-topics.sh
#   ./create-all-kafka-topics.sh
#   CONTAINER=waf-kafka BROKER=kafka:9092 ./create-all-kafka-topics.sh

set -eu

CONTAINER="${CONTAINER:-waf-kafka}"
BROKER="${BROKER:-kafka:9092}"

echo "==> Using CONTAINER=$CONTAINER, BROKER=$BROKER"

kt_exec() {
  # Run kafka-topics inside container, robustly locating the binary
  docker exec "$CONTAINER" sh -lc '
    set -eu
    if command -v kafka-topics >/dev/null 2>&1; then
      KTC=kafka-topics
    elif command -v kafka-topics.sh >/dev/null 2>&1; then
      KTC=kafka-topics.sh
    elif [ -x "${KAFKA_HOME:-}/bin/kafka-topics.sh" ]; then
      KTC="${KAFKA_HOME}/bin/kafka-topics.sh"
    elif [ -x "/opt/bitnami/kafka/bin/kafka-topics.sh" ]; then
      KTC="/opt/bitnami/kafka/bin/kafka-topics.sh"
    else
      echo "ERROR: kafka-topics not found in container PATH/KAFKA_HOME/Bitnami path" >&2
      exit 127
    fi
    "$KTC" --bootstrap-server "'"$BROKER"'" '"$*"'
  '
}

has_if_not_exists() {
  kt_exec "--help" 2>&1 | grep -q -- "--if-not-exists" || return 1
}

topic_exists() {
  # return 0 if topic exists, 1 otherwise
  kt_exec "--list" \
    | tr -d "\r" | awk -v t="$1" '$0==t{found=1} END{exit !found}'
}

create_topic() {
  topic="$1"; partitions="$2"; rf="$3"; shift 3 || true
  CONFIG_ARGS=""
  for cfg in "$@"; do
    CONFIG_ARGS="$CONFIG_ARGS --config $cfg"
  done

  if has_if_not_exists; then
    echo "Ensuring topic '$topic' (with --if-not-exists)"
    kt_exec "--create --if-not-exists --topic $topic --partitions $partitions --replication-factor $rf $CONFIG_ARGS"
  else
    if topic_exists "$topic"; then
      echo "Topic '$topic' already exists. Skipping."
    else
      echo "Creating topic '$topic'"
      kt_exec "--create --topic $topic --partitions $partitions --replication-factor $rf $CONFIG_ARGS"
    fi
  fi

  # Show the result (ignore errors just in case)
  kt_exec "--describe --topic $topic" 2>/dev/null || true
  echo "----"
}

echo "==> Creating topics..."

# ===== Analytics Track Topics =====
create_topic "waf-logs"             6 1                      # 분석용 로그 (스캐너 포함)
create_topic "waf-modsec-raw"       6 1                      # ksqlDB 처리용
create_topic "waf-modsec-enriched"  6 1                      # 룰맵 조인된 데이터
create_topic "waf-modsec-metrics"   3 1                      # 집계 메트릭

# ===== Real-time Track (Kafka) =====
# 실서비스가 Kafka를 사용한다면 다음 토픽을 생성합니다.
create_topic "waf-realtime-events"  3 1 "retention.ms=604800000"  # 7일 보존

# ===== Lookup Tables =====
create_topic "waf-rulemap"          6 1 "cleanup.policy=compact"  # 룰 메타데이터 (압축)

# ===== Archive & Backup =====
create_topic "waf-archive"          3 1 "retention.ms=2592000000" # 30일 보존

echo "==> Done."
