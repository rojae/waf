# 🛡️ Web Application Firewall (WAF) Platform

A Nginx + ModSecurity + OWASP CRS WAF with a Next.js management UI and Kafka-based telemetry. InfluxDB serves metrics, Elasticsearch serves log search, and ClickHouse stores analytics.

[Korean](README.md) · [Reform plan](docs/REFORM-PLAN.md) · [Rule contract](docs/CUSTOM-RULES.md)

This is a development and validation setup. Production security, capacity, latency and availability have not been established.

## Behavior and boundaries

- Google OAuth with an HttpOnly session cookie and authenticated dashboard APIs.
- Metrics, logs and alerts with explicit empty and failure states.
- Persistent custom-rule and IP/CIDR allowlist **drafts**. Saving or enabling a draft does not apply it to the WAF.
- Deployment returns `501` until actual Nginx validation and reload are connected.
- Kafka offsets advance after required sink writes. Recovery can replay records; exactly-once delivery is not promised.
- Compose and local Kubernetes configuration. No Helm chart, production RBAC or deployment operator is included.

The service shape remains Nginx/ModSecurity → Fluent Bit → Kafka (`waf-realtime-events`) → processors and stores. ClickHouse is not queried by the dashboard API. The alert processor and the dashboard's InfluxDB alert queries are separate paths.

## Local setup

Use Docker Engine and Compose v2. Source validation needs Java 21, Node.js 20+, Go as specified by `go.mod`, and Python 3.

```bash
cp .env.example .env
# Set OAuth credentials and database credentials/tokens.
openssl rand -base64 32
# Set JWT_SECRET to the generated value.
docker compose --env-file .env config --quiet
./startup.sh --build
```

Register `http://localhost:3001/login/oauth2/code/google` as the local Google callback. `OAUTH_CALLBACK_BASE_URL` is the frontend origin, not the social API address. Both Java APIs must share `JWT_SECRET`. Never commit real environment files.

Local defaults: dashboard port 3001, WAF demo port 8080, Grafana port 3000, Kibana port 5601. Nginx serves the static demo by default. Configure the actual application upstream separately. Local database and administration ports are not an internet exposure policy.

## Validation

```bash
(cd backend && ./gradlew test)
(cd frontend && npm ci && npm run lint && npm run build)
(cd services/realtime-processor && go test ./...)
(cd services/alert-processor && go test ./...)
python3 -m unittest discover -s kafka-clickhouse-consumer/tests
python3 -m unittest discover -s scripts/tests
```

Additional frontend regression commands are in `frontend/package.json`. CI uses no production credentials. Unit and static checks do not prove actual Google login, a live Nginx rule reload, or the complete broker/database path.

## Storage and review

`WAF_MANAGEMENT_STORE` points to the atomic JSON draft store. Persist its volume and use one dashboard writer. Concurrent processes writing the same file are unsupported.

Apply additive ClickHouse migrations under `clickhouse/` explicitly to existing volumes: initialization scripts do not automatically rerun. Do not recreate existing tables to upgrade them.

Kubernetes configuration is for local validation. Verify secrets, images, volumes and readiness before use. Live deployment, automatic merge, production authorization and high availability are follow-up work.

The [reform plan](docs/REFORM-PLAN.md) records branches and acceptance criteria. Older documents may describe intended features; where they conflict, follow the current README, rule contract, implementation and tests.
