#!/bin/sh
# delete-topic.sh — purge data only (keep topics)

set -eu

CONTAINER="${CONTAINER:-waf-kafka}"
BROKER="${BROKER:-localhost:9092}"

topic_exists() {
  docker exec "$CONTAINER" sh -lc "kafka-topics --bootstrap-server '$BROKER' --list" \
    | tr -d '\r' | awk -v t="$1" '$0==t{found=1} END{exit !found}'
}

purge_normal() {
  t="$1"
  echo "Purging topic '$t' ..."
  docker exec "$CONTAINER" sh -lc \
    "kafka-configs --bootstrap-server '$BROKER' --alter --topic '$t' --add-config retention.ms=0"
  sleep 3
  docker exec "$CONTAINER" sh -lc \
    "kafka-configs --bootstrap-server '$BROKER' --alter --topic '$t' --add-config retention.ms=-1"
  docker exec "$CONTAINER" sh -lc "kafka-topics --bootstrap-server '$BROKER' --describe --topic '$t'" || true
  echo "----"
}

purge_compact() {
  t="$1"
  echo "Purging compact topic '$t' ..."
  # ✨ 각 설정을 개별 --add-config 로 분리 (cleanup.policy는 'compact,delete'가 하나의 값)
  docker exec "$CONTAINER" sh -lc \
    "kafka-configs --bootstrap-server '$BROKER' --alter --topic '$t' \
     --add-config 'cleanup.policy=compact,delete' \
     --add-config 'retention.ms=0' \
     --add-config 'segment.ms=1000' \
     --add-config 'delete.retention.ms=1000' \
     --add-config 'min.cleanable.dirty.ratio=0.01'"
  sleep 3
  # 원복: compact만 남기고 임시 설정 제거
  docker exec "$CONTAINER" sh -lc \
    "kafka-configs --bootstrap-server '$BROKER' --alter --topic '$t' \
     --add-config 'cleanup.policy=compact' \
     --delete-config retention.ms \
     --delete-config segment.ms \
     --delete-config delete.retention.ms \
     --delete-config min.cleanable.dirty.ratio" || true
  docker exec "$CONTAINER" sh -lc "kafka-topics --bootstrap-server '$BROKER' --describe --topic '$t'" || true
  echo "----"
}

# ===== 데이터만 삭제 =====
# normal
topic_exists "waf-modsec-raw"       && purge_normal  "waf-modsec-raw"       || echo "skip: waf-modsec-raw"
topic_exists "waf-modsec-enriched"  && purge_normal  "waf-modsec-enriched"  || echo "skip: waf-modsec-enriched"
topic_exists "waf-modsec-metrics"   && purge_normal  "waf-modsec-metrics"   || echo "skip: waf-modsec-metrics"
topic_exists "waf-logs"             && purge_normal  "waf-logs"             || echo "skip: waf-logs"

# compact
topic_exists "waf-rulemap"          && purge_compact "waf-rulemap"          || echo "skip: waf-rulemap"
