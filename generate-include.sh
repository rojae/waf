#!/bin/bash

############################################################################
# 지정한 경로에 존재하는 .conf 파일을 모두 Include 지시어로 묶어 include.conf를 생성.
############################################################################

RULES_DIR="./nginx/modsecurity/rules"
OUTPUT_FILE="$RULES_DIR/include.conf"

if [ ! -d "$RULES_DIR" ]; then
  echo ">> 디렉토리 없음: $RULES_DIR"
  exit 1
fi

echo "[*] include.conf 생성 중..."

ls "$RULES_DIR"/*.conf | sort | while read -r file; do
  filename=$(basename "$file")
  echo "Include /etc/modsecurity.d/rules/$filename"
done > "$OUTPUT_FILE"

echo "[✔] include.conf 생성 완료: $OUTPUT_FILE"