#!/usr/bin/env sh

######################################################
# waf-nginx container initize script
######################################################

# Force create if not exist directory or logfile
mkdir -p /var/log/modsecurity
#touch /var/log/modsecurity/modsec_audit.log
touch /var/log/modsecurity/modsec_audit.json
chmod -R 777 /var/log/modsecurity

# nginx run
nginx -g "daemon off;"