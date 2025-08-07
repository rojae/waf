FROM owasp/modsecurity:nginx-alpine

# nginx.conf 파일 덮어쓰기가 안되기 때문에, custom dockerFile로 진행한다.
# log : sed: can't move '/etc/nginx/nginx.conf' to '/etc/nginx/nginx.conf': Resource busy

# rm template script
RUN rm -f \
    /docker-entrypoint.d/20-envsubst-on-templates.sh \
    /docker-entrypoint.d/30-tune-worker-processes.sh \
    /docker-entrypoint.d/90-copy-modsecurity-config.sh \
    /docker-entrypoint.d/91-update-resolver.sh \
    /docker-entrypoint.d/92-update-real_ip.sh \
    /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

# conf 파일 복사
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./nginx/modsecurity/modsecurity.conf /etc/modsecurity/modsecurity.conf
COPY ./nginx/modsecurity/crs-setup.conf /etc/modsecurity.d/crs-setup.conf
COPY ./nginx/modsecurity/rules /etc/modsecurity.d/rules
COPY ./nginx/html /usr/share/nginx/html

# custom entrypoint 스크립트 복사
COPY ./nginx/init.sh /init.sh
RUN chmod +x /init.sh

EXPOSE 80

ENTRYPOINT ["/init.sh"]
