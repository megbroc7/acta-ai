# Acta AI

Acta AI is a content workflow platform with:
- Backend API (FastAPI + Postgres)
- Frontend web app (React + Vite + nginx)
- Shopify public app integration (Remix template app)

## Repository Structure

- `backend/` API, auth, scheduler, DB models/migrations, tests
- `frontend/` customer-facing web UI
- `shopify-app/acta-blog-publisher/` Shopify public app code
- `docker-compose.yml` local/containerized stack definition
- `PRODUCTION_COMMERCIALIZATION_GUIDE.md` production readiness checklist and gates
- `backend/docs/security/` security evidence and audit artifacts

## Prerequisites

- Docker + Docker Compose v2
- Python 3.13 (backend local dev)
- Node.js:
  - Frontend uses Node 22 in current workflows
  - Shopify app engine constraint is defined in:
    - `shopify-app/acta-blog-publisher/package.json`
- PostgreSQL 16 (for non-docker local DB workflows)

## Environment Setup

- Root env template:
  - `.env.example`
- Backend env template:
  - `backend/.env.example`

Minimum required for core backend auth/runtime:
- `SECRET_KEY`
- `ENCRYPTION_KEY`
- `BACKEND_BASE_URL`
- `FRONTEND_URL`

Required for feature-complete behavior:
- `OPENAI_API_KEY`
- Shopify app credentials:
  - `SHOPIFY_APP_CLIENT_ID`
  - `SHOPIFY_APP_CLIENT_SECRET`
  - `SHOPIFY_SCOPES`
  - `SHOPIFY_API_VERSION`

Rules:
- Never commit `.env` files or secrets.
- Keep staging/prod secrets in server/runtime secret stores, not in repo.

## Local Development

### Option A: Dev script

```bash
./dev.sh
```

Starts:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/api/v1/docs`

### Option B: Docker Compose

```bash
docker compose up -d --build
```

Default containerized entrypoint is through frontend nginx on port `80`.

## Staging / Production Notes

- Current staging domain: `https://staging.sabina-strategies.com`
- Production readiness checklist lives in `PRODUCTION_COMMERCIALIZATION_GUIDE.md`
- Security verification artifacts should be stored in `backend/docs/security/` and referenced from the guide

## Deploy Runbook (By SHA)

1. Ensure your local branch contains intended changes and is pushed.
2. Record release commit:

```bash
git rev-parse HEAD
```

3. On server:

```bash
cd /opt/acta-ai
git fetch origin --prune
git checkout <release_sha>
docker compose up -d --build
```

4. Verify running revision:

```bash
git rev-parse HEAD
```

Do not treat server-only edits as permanent. Back-port any emergency server change to repo immediately.

## Post-Deploy Smoke Checks

Run at minimum:

```bash
curl -sS https://staging.sabina-strategies.com/api/health
curl -I https://staging.sabina-strategies.com
```

Also validate:
- auth endpoints reachable
- frontend loads without console/runtime errors
- scheduler/worker health visible in health response/logs

## Release Discipline (Required)

1. Make edits in this repo only (not as permanent server-only hotfixes).
2. Commit and push changes.
3. Deploy by exact Git SHA.
4. Verify post-deploy health.
5. Keep checklist/docs/changelog in sync with what was deployed.

### Source of Truth

- Git commit SHA is the release artifact.
- Droplet runtime should match a known SHA.
- If emergency server edits are made, back-port them into repo immediately.

### Where To Make Edits

- Backend app logic: `backend/`
- Frontend app logic: `frontend/`
- Shopify integration: `shopify-app/acta-blog-publisher/`
- Shared runtime/deploy config: `docker-compose.yml`
- Readiness gates and evidence links: `PRODUCTION_COMMERCIALIZATION_GUIDE.md`

## Security / Dependency Gate

For Shopify app dependency risk tracking, run from:
- `shopify-app/acta-blog-publisher/`

Command:

```bash
npm audit --omit=dev
```

Week 1 exit-gate target:
- `0` Critical
- `0` High

## Current Readiness Status

- Master readiness tracker:
  - `PRODUCTION_COMMERCIALIZATION_GUIDE.md`
- Current Week 1 remaining blocker:
  - unresolved Shopify production dependency High vulnerabilities until `npm audit --omit=dev` reports `0` High/Critical

## Changelog

- Root project changelog: `CHANGELOG.md`
- Shopify template/app changelog: `shopify-app/acta-blog-publisher/CHANGELOG.md`

Any meaningful implementation or operational change should be reflected in the appropriate changelog and linked to supporting docs/evidence when relevant.

## Security Hygiene

- Never commit API keys, JWTs, refresh tokens, or private keys.
- If any secret/token is exposed, rotate it immediately and document the rotation.
- Keep local tool permission files (for example local IDE/agent settings) out of production configuration decisions.
