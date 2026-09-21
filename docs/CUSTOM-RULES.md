# Custom rules and whitelist drafts

The management UI keeps the existing rule editor and list views. The backend stores **drafts**; it does not activate ModSecurity rules.

## API contract

All routes require a dashboard session. Browser requests use same-origin Next server proxies.

| Method | Route | Result |
| --- | --- | --- |
| GET / POST | /api/rules | List / validate and persist a draft |
| GET / PUT / DELETE | /api/rules/{id} | Read / update / delete a draft |
| PATCH | /api/rules/{id}/toggle | Persist explicit `{ "enabled": true }` or false |
| POST | /api/rules/validate | Application-level validation |
| POST | /api/rules/deploy | 501: deployment adapter unavailable |
| GET | /api/rules/deployment-status | No fabricated completed deployment |
| GET / POST | /api/whitelist | List / create IP or CIDR drafts |
| PUT / DELETE | /api/whitelist/{id} | Update / delete a draft |
| PATCH | /api/whitelist/{id}/toggle | Persist explicit enabled state |

Rules contain numeric `id`, `name`, `description`, `enabled`, `severity`, `category`, `variables`, `operator`, `operatorData`, `actions`, `priority`, and timestamps. Whitelist records contain string `id`, `ip`, `description`, `enabled`, and timestamps.

`enabled` is draft configuration, not proof of enforcement. Application validation is not the real ModSecurity parser.

## Persistence

Set `WAF_MANAGEMENT_STORE` to a JSON file on a persistent writable volume. Changes use a temporary file and atomic replacement. Failed persistence leaves the last accepted state unchanged. Corrupt existing data must not be silently replaced by an empty store.

This is a single-writer store. Run one dashboard instance against it. Back up the file before infrastructure changes. Multi-instance management needs a database and concurrency policy in a later PR.

## Active WAF configuration

Checked-in Nginx/ModSecurity files are runtime configuration, separate from management drafts. The old in-memory writer and reload-signal shortcut are not a deployment contract.

A future deployment adapter must provide deterministic generation, actual Nginx/ModSecurity syntax validation, atomic activation, confirmed reload/rollout, request verification, rollback and audit history.

Until then, show unavailable status truthfully. A successful CRUD response, regex check, file copy or ConfigMap update is not completed enforcement.

Backend tests cover authentication, validation, CRUD/reload, persistence failure and unavailable deployment. Frontend tests cover failed requests and server proxies. Live WAF enforcement remains a separate integration check. See [the reform plan](REFORM-PLAN.md).
