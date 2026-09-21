# Backend lane report

Branch/worktree: `rojae/waf-reform-backend` at `/Users/jaeseoh/orca/workspaces/waf/waf-reform-backend`

## Contract decisions

- Shared dashboard/social access token: HS256 JWT via `JWT_SECRET` / `app.jwt.secret`, hard minimum 32 bytes, no fallback secret.
- Browser access cookie: `WAF_AT` by default (`app.jwt.cookie-name`), `Path=/`, `SameSite=Lax`, `Max-Age=900`; `Secure` follows `COOKIE_SECURE` / `app.jwt.cookie-secure`.
- Dashboard auth: `/api/**`, `/api`, and matrix-style `/api;...` require valid JWT. Cookie is preferred; `Authorization: Bearer` is accepted. Invalid/missing tokens return 401 and do not fall back.
- Unsafe cookie-backed mutations (`POST`, `PUT`, `PATCH`, `DELETE`) require an `Origin` matching `app.cors.allowed-origins`.
- OAuth state cookie: `WAF_OAUTH_STATE`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=300` by default, `Secure` follows the same configured cookie-secure flag.
- OAuth login: `GET /auth/google/login` returns 302 to Google and sets `WAF_OAUTH_STATE`; extra query params are ignored for redirect-pinning.
- OAuth callback: `GET /auth/google/callback?code&state` rejects missing/mismatched/expired/reused state before provider exchange and clears the state cookie.
- Callback JSON preserves existing snake_case fields and adds compatibility fields: `access_token`, `accessToken`, `expires_in`, `expiresIn`, `user`, `success`, `redirect_url`, and existing `cookie_*` metadata.
- POST `/auth/{provider}/exchange` no longer bypasses state; it fails with `state_validation_required`.
- Rules: canonical numeric-id DTO under `/api/rules`; deploy returns HTTP 501 and deployment status returns 404/no-real-deployment.
- Whitelist: draft CRUD under `/api/whitelist`, literal IPv4/CIDR only, no DNS lookups.
- Draft store: `WAF_MANAGEMENT_STORE` / `app.management.store`, default `./data/management.json`, full JSON temp write then atomic replace; memory swaps only after persistence success; corrupt startup fails closed.
- Telemetry: no random fallback alerts, no mock alert SSE generator, metrics/log/alert sink failures surface as 503/error instead of fabricated healthy data.

## Tests and verification

- `JAVA_HOME=/Users/jaeseoh/Library/Java/JavaVirtualMachines/azul-21.0.8/Contents/Home ./gradlew :waf-common-data:test :waf-social-api:test :waf-dashboard-api:test` -> pass.
- `JAVA_HOME=/Users/jaeseoh/Library/Java/JavaVirtualMachines/azul-21.0.8/Contents/Home ./gradlew test` -> pass.
- `JAVA_HOME=/Users/jaeseoh/Library/Java/JavaVirtualMachines/azul-21.0.8/Contents/Home ./gradlew build` -> pass.
- `JAVA_HOME=/Users/jaeseoh/Library/Java/JavaVirtualMachines/azul-21.0.8/Contents/Home ./gradlew test build` -> pass after the dashboard Spring constructor smoke fix.
- Dashboard smoke:
  - Started `:waf-dashboard-api:bootRun` on port 18082 with `JWT_SECRET=0123456789abcdef0123456789abcdef`, Kafka intentionally pointed to `localhost:65535`, and `app.management.store=./build/tmp/smoke-management.json`.
  - `GET /api/dashboard/metrics` without cookie -> `401 {"error":"no_token"}`.
  - `GET /api;v=1/dashboard/metrics` without cookie -> `401 {"error":"no_token"}`.
  - Kafka broker warnings during smoke are expected because no broker was started; auth was verified before datastore access.

## Regression coverage added

- `SharedJwtServiceTest`: short secret, valid issue/verify, missing expiry, wrong algorithm, expired token.
- `OAuthStateServiceTest`: wrong/missing state, single-use state, expired state.
- `DashboardAuthFilterTest`: missing token for normal and matrix API paths, unsafe cookie mutation Origin rejection, valid Origin acceptance.
- `ManagementDraftStoreTest`: JSON reload, corrupt fail-closed startup, persistence failure preserves memory, whitelist rejects DNS values.
- `TelemetryQueryTest`: alert and metrics Flux filter `_field == "count"`, deliberate grouping, no `_time` sort after aggregation.

## Limitations and follow-ups

- No real nginx/ModSecurity deployment is implemented in this backend lane; draft CRUD intentionally does not apply live WAF config.
- Whitelist validation is IPv4/CIDR only in PR1.
- Dashboard smoke did not connect Kafka, InfluxDB, or Elasticsearch; sink behavior is covered by query/unit tests and controller error handling, not live infrastructure.
- Spring/Gradle still emit existing deprecation/problem-report notices and JPA annotation warnings from common entity classpath, but tests/build pass.
