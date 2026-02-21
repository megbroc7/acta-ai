# Acta AI Production + Commercialization Guide

Last updated: February 21, 2026  
Plan start: Monday, February 23, 2026  
Launch readiness review: Friday, March 20, 2026  
Earliest paid launch window: Monday, March 23, 2026

## 1. Objective

Use this guide to move Acta AI from current state to production-ready and commercially launchable.

Launch scope for this cycle:
- GA: WordPress + Shopify
- Deferred: Wix

## 2. Success Criteria (Must Pass for Go)

1. Security
- No plaintext CMS credentials stored.
- Zero Critical/High vulnerabilities open at launch review.

2. Reliability
- Scheduler execution success rate >= 99% during staging burn-in.
- No duplicate schedule execution during restart/redeploy tests.

3. Operations
- Monitoring and alerts live for API, scheduler, DB, billing webhooks.
- Backup/restore drill completed successfully.

4. Quality
- Critical customer journeys pass automated and manual smoke checks.
- P0/P1 defects closed or formally waived.

5. Commercial readiness
- Stripe checkout, webhook sync, failure handling, and support workflow verified.
- Funnel instrumentation live for signup -> activation -> paid conversion.

## 3. How To Run This Plan

1. Create one epic per week (Week 1 through Week 4).
2. Convert every checklist line item below into a tracked issue.
3. Assign one owner and one reviewer per issue.
4. Require evidence links in each completed issue.
5. Hold weekly gate review every Friday before moving to next week.

## 3.1 Current Status Audit (February 21, 2026)

Audit summary from repository evidence:
- Week 1 checklist implementation is complete in code/config (`7/7` items checked below).
- Week 1 exit gate is complete (`4/4` met).
- Shopify dependency blocker was remediated on February 21, 2026: production-only Shopify app audit reduced from `12` findings (`6` high) to `0` after dependency classification + Docker flow remediation (see security evidence below).
- Auth abuse verification was validated in staging on February 21, 2026.
- Minimum viable CI gates were introduced on February 21, 2026 for backend Shopify regression tests, frontend build, and Shopify app build + production-only High/Critical audit enforcement.
- Weeks 2-4 commercialization checklists are still pending implementation/operational evidence.
- Validation run during this audit:
  - Backend: `cd backend && source .venv/bin/activate && pytest -q` -> `35 passed`.
  - Frontend: `cd frontend && npm run build` -> build succeeded.
  - Shopify regression suites: `cd backend && ./.venv/bin/pytest -q tests/test_shopify_phase_1_4_closeout.py tests/test_shopify_phase_5_webhooks.py` -> `21 passed`.
  - Shopify app build: `cd shopify-app/acta-blog-publisher && npm run build` (Node 22) -> build succeeded.

Week 1 evidence index:
- Credential encryption + migration: `backend/migrations/versions/r7s8t9u0v1w2_encrypt_wordpress_credentials.py`, `backend/tests/test_wordpress_credentials_encryption.py`
- Plaintext credential removal: `backend/migrations/versions/s8t9u0v1w2x3_drop_plaintext_wordpress_columns.py`
- Auth rate limits: `backend/app/api/auth.py`, `backend/app/core/rate_limit.py`, `backend/tests/test_auth_rate_limit.py`
- Auth abuse verification evidence:
  - Local: `backend/docs/security/AUTH_ABUSE_PROTECTION_VERIFICATION_2026-02-21.md`, `backend/docs/security/auth-abuse-protection-verification-2026-02-21.txt`
  - Staging: `backend/docs/security/AUTH_ABUSE_PROTECTION_VERIFICATION_STAGING_2026-02-21.md`, `backend/docs/security/auth-abuse-protection-verification-staging-2026-02-21.txt`
- Refresh token rotation/revocation + frontend handling: `backend/app/api/auth.py`, `backend/tests/test_refresh_token_rotation.py`, `frontend/src/services/api.js`
- Nginx security headers + TLS plan: `frontend/nginx.conf`, `frontend/nginx.tls.conf`, `backend/docs/NGINX_TLS_PLAN.md`
- Vulnerability scan + triage: `backend/docs/security/DEPENDENCY_VULNERABILITY_TRIAGE_2026-02-20.md` and companion JSON scan artifacts in `backend/docs/security/`
- Shopify vulnerability baseline + remediation evidence:
  - `backend/docs/security/SHOPIFY_VULNERABILITY_BASELINE_2026-02-21.md`
  - `backend/docs/security/SHOPIFY_VULNERABILITY_REMEDIATION_STEP2_2026-02-21.md`
  - `backend/docs/security/SHOPIFY_STEP4_REGRESSION_VALIDATION_2026-02-21.md`
  - `backend/docs/security/SHOPIFY_STEP5_CI_GATES_2026-02-21.md`
  - `backend/docs/security/npm-audit-shopify-app-prodonly-2026-02-21.json`
  - `backend/docs/security/npm-audit-shopify-app-prodonly-2026-02-21-after-step2.json`

## 3.2 Environment + Test Context

Current environment status (as of February 21, 2026):
- Staging URL is deployed at `staging.sabina-strategies.com`.
- Development and verification now include both local and staging evidence (see security docs for labeled artifacts).
- HTTPS is enabled for staging (`https://staging.sabina-strategies.com`) with Let's Encrypt on the staging host.
- Any checklist or exit gate item that explicitly requires staging should be closed only with staging-labeled evidence.

## 4. Ownership Matrix

| Workstream | Primary Owner | Reviewer | Backup |
|---|---|---|---|
| Security hardening | TBD | TBD | TBD |
| Scheduler/reliability | TBD | TBD | TBD |
| CI/CD + QA | TBD | TBD | TBD |
| Billing/commercial ops | TBD | TBD | TBD |
| Support/legal/GTM | TBD | TBD | TBD |

## 5. Weekly Execution Plan

## Week 1 (Feb 23-Feb 27): Security Hardening

Objective: close security gaps that block production trust.

Checklist:
- [x] Encrypt WordPress credentials at rest and migrate existing records.
- [x] Remove plaintext credential paths from API/service flows.
- [x] Add rate limiting to `/auth/register`, `/auth/token`, `/auth/refresh`.
- [x] Implement refresh token rotation + revocation model.
- [x] Update frontend auth flow for rotated refresh token handling.
- [x] Add production security headers and TLS plan for nginx.
- [x] Run dependency vulnerability scan and triage all findings.

Evidence required:
- Migration output and rollback notes.
- Before/after architecture note for auth token lifecycle.
- Staging test logs showing rate limits and token rotation working.
- Security scan report with disposition of each finding.

Week 1 exit gate:
- [x] No plaintext CMS credentials remain.
- [x] Auth abuse protections verified in staging (`backend/docs/security/AUTH_ABUSE_PROTECTION_VERIFICATION_STAGING_2026-02-21.md`, raw log: `backend/docs/security/auth-abuse-protection-verification-staging-2026-02-21.txt`).
- [x] Token rotation fully implemented and tested.
- [x] No unresolved Critical/High vulns in production runtime dependency scans (Shopify production-only audit reduced to `0`; evidence in `backend/docs/security/SHOPIFY_VULNERABILITY_REMEDIATION_STEP2_2026-02-21.md` and `backend/docs/security/npm-audit-shopify-app-prodonly-2026-02-21-after-step2.json`).

## Week 2 (Mar 2-Mar 6): Reliability + Operations

Objective: make scheduling and runtime behavior production-stable.

Checklist:
- [ ] Split scheduler execution from API lifecycle into worker pattern.
- [ ] Add idempotency protections for schedule execution.
- [ ] Add structured logging with correlation fields.
- [ ] Add metrics for request rate, error rate, scheduler success/failure, latency.
- [ ] Configure alerting thresholds and routing for critical conditions.
- [ ] Define backup and restore process for Postgres.
- [ ] Execute one full restore drill in staging.
- [ ] Create incident runbook for API outage, DB outage, OpenAI outage, publish failure, webhook failure.

Evidence required:
- Worker startup/health docs and deployment steps.
- Duplicate-run prevention test evidence.
- Dashboard screenshots and sample alert events.
- Backup restore timestamped run log.
- Incident runbook in repo.

Week 2 exit gate:
- [ ] No duplicate scheduler runs in restart tests.
- [ ] Alerts fire correctly and reach on-call path.
- [ ] Restore drill completed within target recovery time.
- [ ] 7-day staging burn-in started or completed with stable behavior.

## Week 3 (Mar 9-Mar 13): CI/CD + QA Depth

Objective: enforce release quality with repeatable automation.

Checklist:
- [x] Add minimum viable CI workflow for backend Shopify regression tests, frontend build, and Shopify production-only dependency scan gate.
- [ ] Add migration safety check in CI.
- [ ] Expand tests beyond Shopify: auth, billing, schedules, posts lifecycle.
- [ ] Add smoke test script for critical journey paths.
- [ ] Create staging deployment workflow with post-deploy health checks.
- [ ] Define merge policy: passing CI required for main.
- [ ] Freeze and triage P0/P1 bugs.

Evidence required:
- CI pipeline run links for success/failure examples.
- Test coverage report snapshot and changed test list.
- Staging deploy logs with health check outputs.
- Bug triage sheet with status and owners.

Week 3 exit gate:
- [ ] CI is mandatory and green for all merges.
- [ ] Critical flows have automated smoke coverage.
- [ ] Staging deploy is reproducible and documented.
- [ ] P0/P1 backlog is launch-clean or explicitly waived.

## Week 4 (Mar 16-Mar 20): Commercialization Readiness

Objective: make billing, support, legal, and launch operations executable.

Checklist:
- [ ] Validate end-to-end billing lifecycle: checkout, webhook sync, tier updates, cancellation, failed payments.
- [ ] Define dunning and recovery playbook for payment failures.
- [ ] Confirm legal pages and policy change process ownership.
- [ ] Implement support operating model: intake, triage, SLA, escalation.
- [ ] Create canned responses and internal troubleshooting guide.
- [ ] Add funnel instrumentation for signup, first site connect, first schedule, first publish, trial->paid, churn.
- [ ] Run full launch dry-run and rollback rehearsal.
- [ ] Prepare Go/No-Go meeting packet.

Evidence required:
- Billing test matrix with pass/fail outcomes.
- Support SOP and escalation tree.
- Funnel dashboard screenshot with event validation.
- Dry-run checklist with issues and resolutions.
- Final Go/No-Go recommendation memo.

Week 4 exit gate:
- [ ] Billing ops verified end-to-end.
- [ ] Support path staffed and tested.
- [ ] Core GTM metrics visible and accurate.
- [ ] Go/No-Go packet complete by March 20.

## 6. Critical Path Dependencies

1. Week 2 depends on Week 1 security baseline.
2. Week 3 depends on Week 2 scheduler and observability stability.
3. Week 4 depends on Week 3 CI discipline and regression stability.

## 7. Go/No-Go Checklist (March 20, 2026)

- [ ] Security criteria passed.
- [ ] Reliability criteria passed.
- [ ] Operations criteria passed.
- [ ] Quality criteria passed.
- [ ] Commercial criteria passed.
- [ ] Launch owner approval.
- [ ] Engineering owner approval.
- [ ] Product owner approval.

Decision:
- [ ] GO for paid launch
- [ ] NO-GO (requires remediation plan)

## 8. Post-Launch (Week 1 After Launch)

- [ ] Daily review of error rate, scheduler failures, billing failures, and support queue.
- [ ] Daily conversion funnel review (trial starts, activation rate, trial->paid).
- [ ] 7-day stabilization report with incidents, fixes, and next priorities.
