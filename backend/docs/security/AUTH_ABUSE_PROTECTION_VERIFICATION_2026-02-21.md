# Auth Abuse Protection Verification (2026-02-21)

Objective:
- Verify auth abuse protections are active for:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/token`
  - `POST /api/v1/auth/refresh`

Environment:
- Backend started locally on `127.0.0.1:8012` with current app config.
- Active limiter settings:
  - `RATE_LIMIT_AUTH_REGISTER=5/minute`
  - `RATE_LIMIT_AUTH_TOKEN=5/minute`
  - `RATE_LIMIT_AUTH_REFRESH=5/minute`
- Source of settings: `backend/app/core/config.py`

Method:
- Sent 6 rapid requests per endpoint from the same client IP.
- Expected behavior:
  - Requests 1-5: normal endpoint behavior (`201/400/401` depending on endpoint/payload).
  - Request 6: `429 Too Many Requests` with `retry-after` header.

Results:
- `POST /auth/register`
  - Attempts 1-5: `201`, then `400` x4 (duplicate email).
  - Attempt 6: `429`, `retry_after=59`.
- `POST /auth/token`
  - Attempts 1-5: `401` x5 (invalid credentials).
  - Attempt 6: `429`, `retry_after=58`.
- `POST /auth/refresh`
  - Attempts 1-5: `401` x5 (invalid refresh token).
  - Attempt 6: `429`, `retry_after=59`.

Conclusion:
- Auth rate limiting is functioning on all three required auth endpoints.
- `429` and `retry-after` behavior were observed consistently at the configured threshold.

Artifacts:
- Raw request/response evidence log:
  - `backend/docs/security/auth-abuse-protection-verification-2026-02-21.txt`
