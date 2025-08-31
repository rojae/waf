#!/usr/bin/env bash

set -euo pipefail

# MaxMind License Key (환경 변수에서 가져오기 권장)
LICENSE_KEY="${MAXMIND_LICENSE_KEY:-}"

if [[ -z "$LICENSE_KEY" ]]; then
  echo "❌ ERROR: LICENSE_KEY 환경 변수가 설정되지 않았습니다."
  echo "   export MAXMIND_LICENSE_KEY=your_maxmind_license_key"
  exit 1
fi

# 작업 폴더 생성
mkdir -p ./lib/geoip
cd ./lib/geoip

echo "🔑 Using LICENSE_KEY (hidden for security)..."

# 다운로드
echo "⬇️  GeoLite2-City.mmdb 다운로드 중..."
if ! curl -f -sSL \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${LICENSE_KEY}&suffix=tar.gz" \
  -o GeoLite2-City.tar.gz; then
  echo "❌ ERROR: 다운로드 실패"
  exit 1
fi
echo "✅ 다운로드 완료: GeoLite2-City.tar.gz"

# 압축 해제
echo "📦 압축 해제 중..."
if ! tar -xvzf GeoLite2-City.tar.gz >/dev/null; then
  echo "❌ ERROR: 압축 해제 실패"
  exit 1
fi

# 최신 디렉토리 이름 찾기
DIR=$(ls -d GeoLite2-City_* 2>/dev/null | head -n 1 || true)
if [[ -z "$DIR" ]]; then
  echo "❌ ERROR: 압축 해제된 디렉토리를 찾을 수 없습니다."
  exit 1
fi

# 디렉토리 정리
echo "📂 디렉토리 정리 중..."
rm -rf GeoLite2-City
mv "$DIR" GeoLite2-City

# 파일 확인
if [[ -f GeoLite2-City/GeoLite2-City.mmdb ]]; then
  # mmdb 정상 여부 체크
  if file GeoLite2-City/GeoLite2-City.mmdb | grep -q "MaxMind DB"; then
    echo "🎉 완료: GeoLite2-City/GeoLite2-City.mmdb 준비됨"
  else
    echo "❌ ERROR: mmdb 파일이 손상되었거나 올바르지 않습니다."
    exit 1
  fi
else
  echo "❌ ERROR: mmdb 파일을 찾을 수 없습니다."
  exit 1
fi

# 청소
rm -f GeoLite2-City.tar.gz