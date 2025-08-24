#!/usr/bin/env sh

######################################################
# waf-nginx container initize script
######################################################

# Force create if not exist directory or logfile
mkdir -p /var/log/modsecurity
mkdir -p /etc/modsecurity/custom-rules
touch /var/log/modsecurity/modsec_audit.json
chmod -R 777 /var/log/modsecurity

# 커스텀 룰 파일을 메인 설정에 포함
if [ ! -f "/etc/modsecurity/rules/custom-rules-include.conf" ]; then
    echo "# Custom Rules Include" > /etc/modsecurity/rules/custom-rules-include.conf
    echo "Include /etc/modsecurity/custom-rules/custom-rules.conf" >> /etc/modsecurity/rules/custom-rules-include.conf
fi

# 초기 빈 커스텀 룰 파일 생성
if [ ! -f "/etc/modsecurity/custom-rules/custom-rules.conf" ]; then
    echo "# WAF Custom Rules - Auto-generated from Redis" > /etc/modsecurity/custom-rules/custom-rules.conf
    echo "# No custom rules defined yet" >> /etc/modsecurity/custom-rules/custom-rules.conf
fi

# 백그라운드에서 리로드 신호 모니터링
monitor_reload() {
    while true; do
        if [ -f "/tmp/modsec_reload_signal" ]; then
            echo "$(date): ModSecurity reload signal detected"
            
            # 설정 파일 유효성 검사
            nginx -t
            if [ $? -eq 0 ]; then
                # Graceful reload (무중단)
                nginx -s reload
                echo "$(date): ModSecurity rules reloaded successfully"
            else
                echo "$(date): Configuration test failed, skipping reload"
            fi
            
            # 신호 파일 제거
            rm -f /tmp/modsec_reload_signal
        fi
        
        sleep 5
    done
}

# 백그라운드에서 모니터링 시작
monitor_reload &

# nginx run
nginx -g "daemon off;"