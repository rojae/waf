## Nikto
Web security vulnerability scanning tools

### Scan
```sh
perl nikto.pl -h 127.0.0.1 -p 8080 -C all
```

### Reported vulnerability - 2025.08.18 
```sh
your_name@your_notebook program % perl nikto.pl -h 127.0.0.1 -p 8080 -C all

- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          127.0.0.1
+ Target Hostname:    127.0.0.1
+ Target Port:        8080
+ Start Time:         2025-08-18 06:27:20 (GMT9)
---------------------------------------------------------------------------
+ Server: nginx/1.22.1
+ /: The X-Content-Type-Options header is not set. This could allow the user agent to render the content of the site in a different fashion to the MIME type. See: https://www.netsparker.com/web-vulnerability-scanner/vulnerabilities/missing-content-type-header/
+ /: Suggested security header missing: referrer-policy. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
+ /: Suggested security header missing: permissions-policy. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy
+ /: Suggested security header missing: content-security-policy. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
+ /: Suggested security header missing: x-content-type-options. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
+ /: Suggested security header missing: strict-transport-security. See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
+ /test.html: This might be interesting.
+ 26599 requests: 0 error(s) and 7 item(s) reported on remote host
+ End Time:           2025-08-18 06:29:42 (GMT9) (142 seconds)
---------------------------------------------------------------------------
+ 1 host(s) tested
```