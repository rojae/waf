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
if [ ! -f "/etc/modsecurity/custom-rules/custom-rules.conf" ]; then
    echo "# WAF Custom Rules - mounted runtime rules" > /etc/modsecurity/custom-rules/custom-rules.conf
    echo "# No custom rules defined yet" >> /etc/modsecurity/custom-rules/custom-rules.conf
fi

nginx -t

# nginx run
nginx -g "daemon off;"
