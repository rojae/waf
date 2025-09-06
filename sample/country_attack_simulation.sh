#!/bin/bash

# 국가별 공격 시뮬레이션 스크립트
# GeoIP 데이터베이스를 활용한 국가별 위협 분석 테스트

WAF_URL="http://localhost:8080"
COLORS=("31" "32" "33" "34" "35" "36" "91" "92" "93" "94" "95" "96")

# 국가별 실제 IP 범위 (공개 IP 대역) - 배열로 변경
COUNTRY_NAMES=("Korea" "China" "Russia" "USA" "Germany" "Japan" "Brazil")
COUNTRY_IPS["Korea"]="1.201.0.1 121.78.72.1 175.45.176.1"
COUNTRY_IPS["China"]="1.2.4.1 14.17.22.1 58.240.127.1 223.5.5.5"
COUNTRY_IPS["Russia"]="5.18.128.1 31.13.128.1 85.26.128.1 188.93.16.1"
COUNTRY_IPS["USA"]="8.8.8.8 208.67.222.222 173.194.174.84 74.125.224.72"
COUNTRY_IPS["Germany"]="85.214.132.1 217.160.0.1 62.138.0.1"
COUNTRY_IPS["Japan"]="133.242.0.1 203.174.65.12 210.196.3.183"
COUNTRY_IPS["Brazil"]="200.160.2.3 189.38.95.1 177.43.0.1"

print_header() {
    local color=$1
    local text=$2
    echo -e "\n\033[1;${color}m=== $text ===\033[0m"
}

simulate_attack() {
    local country=$1
    local ip=$2
    local attack_type=$3
    local payload=$4
    local color_index=$((RANDOM % ${#COLORS[@]}))
    local color=${COLORS[$color_index]}
    
    echo -e "\033[${color}m[$country - $ip] $attack_type 공격 시뮬레이션...\033[0m"
    
    case $attack_type in
        "XSS")
            curl -s -H "X-Forwarded-For: $ip" \
                 -H "User-Agent: AttackBot/1.0 ($country)" \
                 "$WAF_URL/search?q=$payload" > /dev/null
            ;;
        "SQLi")
            curl -s -H "X-Forwarded-For: $ip" \
                 -H "User-Agent: SQLBot/1.0 ($country)" \
                 -X POST "$WAF_URL/login" \
                 -d "username=$payload&password=test" > /dev/null
            ;;
        "Scanner")
            curl -s -H "X-Forwarded-For: $ip" \
                 -H "User-Agent: $payload" \
                 "$WAF_URL/" > /dev/null
            ;;
        "Path_Traversal")
            curl -s -H "X-Forwarded-For: $ip" \
                 -H "User-Agent: PathBot/1.0 ($country)" \
                 "$WAF_URL/file?path=$payload" > /dev/null
            ;;
    esac
    
    sleep 0.5
}

# 공격 패턴 정의
declare -A ATTACK_PATTERNS
ATTACK_PATTERNS["XSS"]="<script>alert('XSS-from-$1')</script> <img src=x onerror=alert('$1')>"
ATTACK_PATTERNS["SQLi"]="admin' OR '1'='1 admin'; DROP TABLE users; --"
ATTACK_PATTERNS["Scanner"]="Nmap/7.80 Nikto/2.1.6 sqlmap/1.4.12"
ATTACK_PATTERNS["Path_Traversal"]="../../../../etc/passwd ../../../windows/system32/drivers/etc/hosts"

main() {
    print_header "96" "🌍 국가별 WAF 공격 시뮬레이션 시작"
    echo "WAF URL: $WAF_URL"
    echo "실시간 모니터링: http://localhost:3000 (Grafana)"
    echo "보안 분석: http://localhost:5601 (Kibana)"
    echo ""
    
    # 각 국가별로 공격 시뮬레이션
    for country in "${!COUNTRY_IPS[@]}"; do
        print_header "94" "🚀 $country 에서의 공격 시뮬레이션"
        
        # 해당 국가의 IP들 가져오기
        IFS=' ' read -ra IPS <<< "${COUNTRY_IPS[$country]}"
        
        for ip in "${IPS[@]}"; do
            # 각 IP에서 다양한 공격 수행
            simulate_attack "$country" "$ip" "XSS" "<script>alert('$country-attack')</script>"
            simulate_attack "$country" "$ip" "SQLi" "admin' OR 1=1 -- $country"
            simulate_attack "$country" "$ip" "Scanner" "Nmap/7.80-$country-scan"
            simulate_attack "$country" "$ip" "Path_Traversal" "../../../../etc/passwd"
            
            # 정상 트래픽도 섞어서 현실적으로 만들기
            curl -s -H "X-Forwarded-For: $ip" \
                 -H "User-Agent: Mozilla/5.0 (Normal-$country-User)" \
                 "$WAF_URL/" > /dev/null
        done
        
        echo -e "\033[92m✅ $country 공격 시뮬레이션 완료\033[0m"
        sleep 2
    done
    
    print_header "93" "📊 모니터링 안내"
    echo "1. Grafana 대시보드: http://localhost:3000"
    echo "   - 실시간 국가별 공격 통계 확인"
    echo "   - 공격 유형별 분포 분석"
    echo ""
    echo "2. Kibana 대시보드: http://localhost:5601" 
    echo "   - 상세 보안 이벤트 분석"
    echo "   - 국가별 위협 지도 시각화"
    echo ""
    echo "3. 실시간 로그 확인:"
    echo "   docker logs -f waf-realtime-processor"
    echo ""
    print_header "96" "🎯 공격 시뮬레이션 완료!"
}

# 스크립트 실행 확인
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi