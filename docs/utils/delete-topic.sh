#!/bin/sh
# delete-topic.sh — purge data only (keep topics)
# Usage:
#   chmod +x delete-topic.sh
#   ./delete-topic.sh
#   CONTAINER=waf-kafka BROKER=localhost:9092 ./delete-topic.sh

set -eu

CONTAINER="${CONTAINER:-waf-kafka}"
BROKER="${BROKER:-localhost:9092}"

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

kt_configs() {
  # Run kafka-configs inside container, robustly locating the binary
  docker exec "$CONTAINER" sh -lc '
    set -eu
    if command -v kafka-configs >/dev/null 2>&1; then
      KCC=kafka-configs
    elif command -v kafka-configs.sh >/dev/null 2>&1; then
      KCC=kafka-configs.sh
    elif [ -x "${KAFKA_HOME:-}/bin/kafka-configs.sh" ]; then
      KCC="${KAFKA_HOME}/bin/kafka-configs.sh"
    elif [ -x "/opt/bitnami/kafka/bin/kafka-configs.sh" ]; then
      KCC="/opt/bitnami/kafka/bin/kafka-configs.sh"
    else
      echo "ERROR: kafka-configs not found in container PATH/KAFKA_HOME/Bitnami path" >&2
      exit 127
    fi
    "$KCC" --bootstrap-server "'"$BROKER"'" '"$*"'
  '
}

topic_exists() {
  # return 0 if topic exists, 1 otherwise
  kt_exec "--list" \
    | tr -d "\r" | awk -v t="$1" '$0==t{found=1} END{exit !found}'
}

purge_normal() {
  t="$1"
  echo "Purging topic '$t' ..."
  kt_configs "--alter --topic '$t' --add-config retention.ms=0"
  sleep 3
  kt_configs "--alter --topic '$t' --add-config retention.ms=-1"
  kt_exec "--describe --topic '$t'" || true
  echo "----"
}

purge_compact() {
  t="$1"
  echo "Purging compact topic '$t' ..."
  # ✨ 각 설정을 개별 --add-config 로 분리 (cleanup.policy는 'compact,delete'가 하나의 값)
  kt_configs "--alter --topic '$t' \
     --add-config 'cleanup.policy=compact,delete' \
     --add-config 'retention.ms=0' \
     --add-config 'segment.ms=1000' \
     --add-config 'delete.retention.ms=1000' \
     --add-config 'min.cleanable.dirty.ratio=0.01'"
  sleep 3
  # 원복: compact만 남기고 임시 설정 제거
  kt_configs "--alter --topic '$t' \
     --add-config 'cleanup.policy=compact' \
     --delete-config retention.ms \
     --delete-config segment.ms \
     --delete-config delete.retention.ms \
     --delete-config min.cleanable.dirty.ratio" || true
  kt_exec "--describe --topic '$t'" || true
  echo "----"
}

echo "==> Purging topic data (keeping topics)..."

# ===== Analytics Track Topics =====
topic_exists "waf-logs"             && purge_normal  "waf-logs"             || echo "skip: waf-logs"
topic_exists "waf-modsec-raw"       && purge_normal  "waf-modsec-raw"       || echo "skip: waf-modsec-raw"  
topic_exists "waf-modsec-enriched"  && purge_normal  "waf-modsec-enriched"  || echo "skip: waf-modsec-enriched"
topic_exists "waf-modsec-metrics"   && purge_normal  "waf-modsec-metrics"   || echo "skip: waf-modsec-metrics"

# ===== Real-time Track Topics =====
topic_exists "waf-realtime-events"  && purge_normal  "waf-realtime-events"  || echo "skip: waf-realtime-events"
topic_exists "waf-alerts"           && purge_normal  "waf-alerts"           || echo "skip: waf-alerts"

# ===== Lookup Tables (Compact Topics) =====
topic_exists "waf-rulemap"          && purge_compact "waf-rulemap"          || echo "skip: waf-rulemap"

# ===== Archive & Backup =====
topic_exists "waf-archive"          && purge_normal  "waf-archive"          || echo "skip: waf-archive"

echo "==> Done."
