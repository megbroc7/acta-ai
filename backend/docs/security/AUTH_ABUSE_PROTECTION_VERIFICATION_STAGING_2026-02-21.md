# Auth Abuse Protection Verification (Staging) (2026-02-21)

Objective:
- Verify auth abuse protections are active in staging for:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/token`
  - `POST /api/v1/auth/refresh`

Staging target:
- Domain: `staging.sabina-strategies.com`
- Runtime path validated: host nginx -> frontend nginx -> backend API

Method:
- Sent 6 rapid requests per endpoint from the same client context on the staging host.
- Expected behavior:
  - Requests 1-5: normal endpoint behavior (`201/400/401` depending on endpoint/payload).
  - Request 6: `429 Too Many Requests` with `Retry-After`.

Results:
- `POST /auth/register`
  - Attempts 1-5: `201`, then `400` (duplicate email).
  - Attempt 6: `429`, `Retry-After=59`.
- `POST /auth/token`
  - Attempts 1-5: `401` (invalid credentials).
  - Attempt 6: `429`, `Retry-After=59`.
- `POST /auth/refresh`
  - Attempts 1-5: `401` (invalid refresh token).
  - Attempt 6: `429`, `Retry-After=59`.

Conclusion:
- Auth abuse protection is functioning in staging on all required auth endpoints.

Artifacts:
- Raw staging request/response evidence:
  - `backend/docs/security/auth-abuse-protection-verification-staging-2026-02-21.txt`

Notes:
- HTTPS for staging was enabled after DNS delegation was corrected.
- Auth abuse control verification result remains valid for the deployed staging runtime.
