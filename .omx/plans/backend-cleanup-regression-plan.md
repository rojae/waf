# Backend reliability cleanup and regression plan

Scope: `backend/**` only for product code and tests. Coordination artifacts may be written under ignored `.omx/**`.

Constraints:
- Preserve services/UI contracts; do not edit frontend, pipeline, nginx, deployment, PR, push, or original cwd.
- No new libraries. Reuse Spring/Jackson/Nimbus dependencies already present in the backend.
- CRUD endpoints are management drafts only; they must not write active nginx/ModSecurity config or claim enforcement.
- Unsafe cookie-backed mutations require an allowlisted Origin matching configured CORS origins.

Regression tests:
1. OAuth state rejects missing, wrong, expired, and reused state before provider exchange; login emits an HttpOnly `WAF_OAUTH_STATE` cookie with `Path=/`.
2. Shared JWT rejects short secrets, missing expiry, expired tokens, bad algorithms, bad signatures, and missing subjects.
3. Dashboard auth rejects missing/invalid `WAF_AT`; cookie-backed unsafe mutations reject missing/wrong Origin.
4. Rule/whitelist draft store persists atomically, reloads from JSON, fails closed on corrupt JSON, and mutates memory only after persistence success.
5. Telemetry query tests prove alert/metric Flux filters `_field == "count"`, uses deliberate grouping, and does not sort by `_time` after aggregation.

Implementation sequence:
1. Shared JWT support in `waf-common-data`; social/dashboard use the same verifier.
2. OAuth cookie-state handling; disable state-bypass exchange; remove code/state/token logging.
3. Dashboard `/api/**` auth/origin filter and default-disabled debug test routes.
4. Draft JSON store and `/api/rules` plus `/api/whitelist` controllers; deploy returns truthful `501`.
5. Truthful telemetry and bounded realtime SSE fanout.
6. Run targeted tests and Gradle verification with Java 21; record exact results and limitations in `.omx/backend-report.md`.
