# Shopify Step 4 Regression Validation (2026-02-21)

Scope:
- Validate Shopify regression behavior after dependency reclassification/remediation work.

## 1. Backend Shopify Test Suites

Command:

```bash
cd /Users/meganbroccoli/Desktop/Sabina/Web\ Services/Acta\ AI/backend
./.venv/bin/pytest -q tests/test_shopify_phase_1_4_closeout.py tests/test_shopify_phase_5_webhooks.py
```

Result:
- `21 passed`
- No failures in OAuth callback, blog fetch, publish path, or webhook routes/handling tests.

## 2. Shopify App Build Validation

Command:

```bash
cd /Users/meganbroccoli/Desktop/Sabina/Web\ Services/Acta\ AI/shopify-app/acta-blog-publisher
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run build
```

Result:
- Build succeeded for client + SSR bundles.
- Existing CSS warning remained (`@media (--p-breakpoints-md-up) and print`) and is non-blocking.

## 3. Docker-Equivalent Dependency Flow Validation

Validated the same install/build/prune sequence used by the Dockerfile in an isolated temp copy:

1. `npm ci --include=dev`
2. `npm run build`
3. `npm prune --omit=dev`

Checks:
- `@remix-run/dev` absent after prune (`DEV_PKG_PRUNED`)
- `@remix-run/node` present after prune (`RUNTIME_PKG_PRESENT`)

Conclusion:
- Runtime pruning behavior is correct after moving build tooling to `devDependencies`.
- Build-time tooling remains available during build phase.
