#!/bin/sh
# delete-topic-completely.sh — completely delete topics (not just purge data)
# Usage:
#   chmod +x delete-topic-completely.sh
#   ./delete-topic-completely.sh
#   CONTAINER=waf-kafka BROKER=localhost:9092 ./delete-topic-completely.sh

set -eu

CONTAINER="${CONTAINER:-waf-kafka}"
BROKER="${BROKER:-localhost:9092}"

echo "==> Using CONTAINER=$CONTAINER, BROKER=$BROKER"
echo "⚠️  WARNING: This will COMPLETELY DELETE topics, not just purge data!"
echo "Press Enter to continue, or Ctrl+C to abort..."
read -r

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

topic_exists() {
  # return 0 if topic exists, 1 otherwise
  kt_exec "--list" \
    | tr -d "\r" | awk -v t="$1" '$0==t{found=1} END{exit !found}'
}

delete_topic() {
  t="$1"
  if topic_exists "$t"; then
    echo "Deleting topic '$t' completely..."
    kt_exec "--delete --topic '$t'"
    echo "Topic '$t' deleted."
  else
    echo "Topic '$t' does not exist. Skipping."
  fi
  echo "----"
}

echo "==> Completely deleting topics..."

# ===== Analytics Track Topics =====
delete_topic "waf-logs"
delete_topic "waf-modsec-raw"  
delete_topic "waf-modsec-enriched"
delete_topic "waf-modsec-metrics"

# ===== Real-time Track Topics =====
delete_topic "waf-realtime-events"
delete_topic "waf-alerts"

# ===== Lookup Tables (Compact Topics) =====
delete_topic "waf-rulemap"

# ===== Archive & Backup =====
delete_topic "waf-archive"

echo "==> All topics deleted."
echo "💡 To recreate topics, run: ./kafka/ensure-topics.sh"