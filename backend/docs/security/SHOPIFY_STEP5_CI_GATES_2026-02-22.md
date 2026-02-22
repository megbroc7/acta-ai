# Shopify Step 5 CI Gates Validation (February 22, 2026)

Scope:
- Introduce minimum viable CI gates for commercialization risk control.
- Trigger on pull requests and pushes to `main`.

Workflow:
- `.github/workflows/ci-shopify-commercialization.yml`

## Enforced Gates

1. Backend Shopify regression suites
- Working directory: `backend/`
- Command:

```bash
pytest -q tests/test_shopify_phase_1_4_closeout.py tests/test_shopify_phase_5_webhooks.py
```

2. Frontend production build
- Working directory: `frontend/`
- Command:

```bash
npm run build
```

3. Shopify app commercialization gate
- Working directory: `shopify-app/acta-blog-publisher/`
- Runtime: Node `22.22.0`
- Engine enforcement: `NPM_CONFIG_ENGINE_STRICT=true` during dependency install
- Commands:

```bash
npm run build
npm audit --omit=dev --audit-level=high
```

## Determinism / Performance Controls

- Dependency lockfiles are enforced with `npm ci` for frontend and Shopify jobs.
- Dependency caches enabled:
  - pip cache keyed by `backend/requirements.txt`
  - npm cache keyed by frontend and Shopify lockfiles
- Jobs run in parallel to reduce total CI wall-clock time.

## Gate Outcome Semantics

- Any backend regression test failure fails CI.
- Any frontend build failure fails CI.
- Any Shopify build failure fails CI.
- Any Shopify production dependency vulnerability at `high` or `critical` severity fails CI via `npm audit --omit=dev --audit-level=high`.
