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

# directory
RUN mkdir -p /var/log/modsecurity && chmod -R 777 /var/log/modsecurity

# conf
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./nginx/modsecurity/modsecurity.conf /etc/modsecurity/modsecurity.conf
COPY ./nginx/modsecurity/crs-setup.conf /etc/modsecurity.d/crs-setup.conf
COPY ./nginx/modsecurity/rules /etc/modsecurity.d/rules
COPY ./nginx/modsecurity/include.conf /etc/modsecurity.d/include.conf
COPY ./nginx/html /usr/share/nginx/html

# run
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]