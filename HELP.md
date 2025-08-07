# waf-nginx

## commandline

### coreruleset clone
```sh
git clone https://github.com/coreruleset/coreruleset.git
```

### module's loading check
```sh
nginx -V 2>&1 | grep -i modsecurity
```

### Check `ngx_http_modsecurity_module.so` location in container
```sh
ls -al /usr/lib/nginx/modules
```

### Test for 403 Forbidden (ModSecurity)
```sh
curl -i "http://localhost:8080/?q=<script>alert(1)</script>"
```