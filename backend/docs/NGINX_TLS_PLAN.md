# Nginx Production Security Headers + TLS Plan

This document is the deployment plan for Week 1 item:
- `Add production security headers and TLS plan for nginx`

## 1. Scope

Goal:
- Serve frontend and proxied API traffic over HTTPS only.
- Enforce modern security headers at the nginx edge.
- Keep current SPA routing and `/api/` proxy behavior intact.

In-repo artifacts:
- Runtime HTTP config with security headers:
  - `frontend/nginx.conf`
- Production TLS nginx template:
  - `frontend/nginx.tls.conf`

## 2. Security Header Baseline

Headers enforced in nginx:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Content-Security-Policy` with locked-down defaults for scripts, frames, forms, and origins

TLS-only header (in HTTPS server block):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

Note:
- Because nginx `add_header` in `location` blocks overrides inherited headers, security headers are explicitly re-declared in the static asset location.

## 3. TLS Deployment Steps (Let's Encrypt)

1. Provision DNS:
- Point `acta.example.com` (and `www` if used) to the production host.

2. Install nginx + certbot on host:
- Ubuntu example:
  - `sudo apt-get update`
  - `sudo apt-get install -y nginx certbot python3-certbot-nginx`

3. Install production config:
- Copy `frontend/nginx.tls.conf` to `/etc/nginx/conf.d/acta.conf`.
- Replace all `acta.example.com` placeholders with your real domain.

4. Validate and reload nginx:
- `sudo nginx -t`
- `sudo systemctl reload nginx`

5. Issue TLS certificates:
- `sudo certbot --nginx -d acta.example.com -d www.acta.example.com`

6. Enable automated renewal:
- `sudo systemctl enable certbot.timer`
- `sudo systemctl start certbot.timer`
- Test dry run:
  - `sudo certbot renew --dry-run`

## 4. Verification Checklist

After cutover:
- `curl -I http://acta.example.com` returns `301` to `https://...`
- `curl -I https://acta.example.com` includes:
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- SSL Labs scan target grade: `A` or better.
- Frontend routes load correctly (SPA fallback verified).
- Auth and API traffic still work through `/api/`.

## 5. Rollback Plan

If TLS rollout causes runtime issues:
1. Restore previous nginx config backup.
2. Run `sudo nginx -t`.
3. Reload nginx: `sudo systemctl reload nginx`.
4. Keep certificate files intact; only revert server blocks.

## 6. Operational Notes

- This repo currently runs nginx in the frontend container for local/docker use.
- For production, terminate TLS at the internet-facing nginx layer using `frontend/nginx.tls.conf`.
- If a cloud load balancer terminates TLS before nginx, enforce equivalent headers and HTTPS redirect at the true edge.
