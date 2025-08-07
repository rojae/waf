# waf
Nginx Application (WAF) based on `OWASP ModSecurity Core Rule Set (CRS)`

---

## Components
- **Nginx + ModSecurity**: WebServer(with ModSecurity engine)
  - **OWASP CRS**: Attack Inspect Ruleset (`git pull https://github.com/coreruleset/coreruleset.git`)
  - **Docker Compose**: LocalSetting docker-compose (custom dockerfile using `owasp/modsecurity:nginx-alpine`)

---

## Directory tree

```
├── startup.sh                            # startup.sh (First entry)
├── Dockerfile                            # customized dockerfile
├── docker-compose.yml
├── nginx
│   ├── nginx.conf                        # Nginx main config
│   ├── init.sh                           # WAF initize sh
│   ├── html/
│   │   └── 403.html                      # 403 page
│   │   └── 404.html                      # 404 page
│   └── modsecurity/
│       ├── modsecurity.conf             # ModSecurity config
│       ├── crs-setup.conf               # CRS setup, default setting
│       ├── include.conf                 # included rule
│       └── rules/                       # CRS ruleset (.conf, .data)
```

---

## How to run?

```bash
# 1. build container.
docker-compose build --no-cache

# 2. docker-compose up!
docker-compose up
```

---

## How to Test?

### Request
```bash
curl "http://localhost:8080/?q=<script>alert(1)</script>" -i
```

### Response
```http
some_user@your_desktop waf % curl "http://localhost:8080/?q=<script>alert(1)</script>" -i

HTTP/1.1 403 Forbidden
Server: nginx/1.22.1
Date: Thu, 07 Aug 2025 14:34:23 GMT
Content-Type: text/html
Content-Length: 164
Connection: keep-alive
ETag: "6894b4aa-a4"

<!DOCTYPE html>
<html>
<head>
  <title>403 Forbidden</title>
</head>
<body>
  <h1>403 Forbidden</h1>
  <p>Access has been blocked. (ModSecurity)</p>
</body>
</html>
```

---

## How check log?

```bash
# Docker Logs (should append -f)
docker logs waf-nginx

# modsecurity logs in docker-container
docker exec -it waf-nginx cat /var/log/modsecurity/modsec_audit.log
```

---

## Point check.

- **`modsecurity.conf`**
  ```conf
    SecRuleEngine On
    SecRequestBodyAccess On
    SecResponseBodyAccess Off
    SecAuditEngine RelevantOnly
    SecAuditLogParts ABIJDEFHZ
    SecAuditLog /var/log/modsecurity/modsec_audit.log
    Include /etc/modsecurity.d/crs-setup.conf
    Include /etc/modsecurity.d/rules/*.conf
  ```

- **`nginx.conf`**
    ```conf
        # modsecurity config
        modsecurity on;
        modsecurity_rules_file /etc/modsecurity/modsecurity.conf;
    ```

- **`403 page`**
  ```nginx
  error_page 403 /403.html;

  location = /403.html {
      root /usr/share/nginx/html;
      internal;
  }
  ```

---

## Rule setting example

| Case     | Rule ID  | Rule File                            |
|---------------|----------|--------------------------------------|
| XSS           | 941100   | REQUEST-941-APPLICATION-ATTACK-XSS   |
| SQL Injection | 942100   | REQUEST-942-APPLICATION-ATTACK-SQLI  |
| LFI           | 930100   | REQUEST-930-APPLICATION-ATTACK-LFI   |

---

## Reference

- [OWASP CRS GitHub](https://github.com/coreruleset/coreruleset)
- [ModSecurity Reference Manual](https://github.com/SpiderLabs/ModSecurity/wiki)
