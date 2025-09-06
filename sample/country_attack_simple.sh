#!/bin/bash

# 간단한 국가별 공격 시뮬레이션 스크립트
WAF_URL="http://localhost:8080"

echo "=== 🌍 국가별 WAF 공격 시뮬레이션 시작 ==="
echo "WAF URL: $WAF_URL"
echo "실시간 모니터링: http://localhost:3000 (Grafana)"
echo ""

# 한국 IP에서 공격
echo "🇰🇷 한국(Korea) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 175.45.176.1" -H "User-Agent: AttackBot-Korea" \
     "$WAF_URL/search?q=<script>alert('Korea-XSS')</script>" > /dev/null
echo "✅ XSS 공격 완료"

curl -s -H "X-Forwarded-For: 121.78.72.1" -H "User-Agent: SQLBot-Korea" \
     -X POST "$WAF_URL/login" -d "username=admin' OR 1=1 -- &password=test" > /dev/null
echo "✅ SQL Injection 공격 완료"

# 중국 IP에서 공격  
echo "🇨🇳 중국(China) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 58.240.127.1" -H "User-Agent: Nikto-China-Scanner" \
     "$WAF_URL/" > /dev/null
echo "✅ 스캐너 공격 완료"

curl -s -H "X-Forwarded-For: 223.5.5.5" -H "User-Agent: PathBot-China" \
     "$WAF_URL/file?path=../../../../etc/passwd" > /dev/null
echo "✅ Path Traversal 공격 완료"

# 러시아 IP에서 공격
echo "🇷🇺 러시아(Russia) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 85.26.128.1" -H "User-Agent: AttackBot-Russia" \
     "$WAF_URL/search?q=<img src=x onerror=alert('Russia')>" > /dev/null
echo "✅ XSS 공격 완료"

# 미국 IP에서 공격
echo "🇺🇸 미국(USA) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 173.194.174.84" -H "User-Agent: sqlmap-USA" \
     -X POST "$WAF_URL/login" -d "username=admin'; DROP TABLE users; --&password=test" > /dev/null
echo "✅ SQL Injection 공격 완료"

# 독일 IP에서 공격
echo "🇩🇪 독일(Germany) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 85.214.132.1" -H "User-Agent: Nmap-Germany/7.80" \
     "$WAF_URL/admin" > /dev/null
echo "✅ 스캐너 공격 완료"

# 일본 IP에서 공격
echo "🇯🇵 일본(Japan) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 133.242.0.1" -H "User-Agent: AttackBot-Japan" \
     "$WAF_URL/search?q=%3Cscript%3Ealert('Japan')%3C/script%3E" > /dev/null
echo "✅ XSS 공격 완료"

# 브라질 IP에서 공격
echo "🇧🇷 브라질(Brazil) IP에서 공격 시뮬레이션..."
curl -s -H "X-Forwarded-For: 200.160.2.3" -H "User-Agent: PathBot-Brazil" \
     "$WAF_URL/file?path=../../../windows/system32/config/SAM" > /dev/null
echo "✅ Path Traversal 공격 완료"

echo ""
echo "=== 📊 모니터링 안내 ==="
echo "1. Grafana: http://localhost:3000"
echo "2. Kibana: http://localhost:5601"
echo "3. 실시간 로그: docker logs -f waf-realtime-processor"
echo ""
echo "🎯 국가별 공격 시뮬레이션 완료!"
echo "실시간 프로세서에서 GeoIP 정보와 함께 로그를 확인하세요."