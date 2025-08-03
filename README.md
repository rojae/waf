## waf-nginx

### module's loading check
```sh
nginx -V 2>&1 | grep -i modsecurity
```

### ngx_http_modsecurity_module.so location in container
```sh
ls -al /usr/lib/nginx/modules
# you can see like `/usr/lib/nginx/modules`
```

### Test
```sh
curl -i "http://localhost:8080/?q=<script>alert(1)</script>"
```