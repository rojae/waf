# TODO — Backend-driven Custom ModSecurity Rules

## Wiring the include & volume
- In `nginx/modsecurity/modsecurity.conf`, add:
  ```conf
  Include /etc/modsecurity/custom-rules/*.conf
  ```

- In `docker-compose.yml`,
  ```yml
  volumes:
  - ./nginx/modsecurity/custom-rules:/etc/modsecurity/custom-rules
  ```