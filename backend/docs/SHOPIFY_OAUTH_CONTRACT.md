# Shopify OAuth Contract (Phase 1-4)

Canonical backend routes:

- `POST /api/v1/shopify/install-url`
  - Auth required.
  - Validates site ownership and platform (`shopify`) before issuing install URL.
  - Returns OAuth authorize URL with signed short-lived `state`.

- `GET /api/v1/shopify/callback`
  - Shopify OAuth callback target.
  - Validates callback HMAC, `state`, and shop-domain match.
  - Exchanges code for offline token.
  - Stores token encrypted in `shopify_connections`.
  - Clears legacy plaintext `sites.api_key` field.
  - Redirects to frontend site edit page with `shopify_connected=1` or `shopify_error=...`.

- `GET /api/v1/shopify/sites/{site_id}/blogs`
  - Auth required.
  - Reads token from encrypted connection and returns available blogs.
  - Response includes `connected` boolean and normalized blog options.

Security and data guarantees:

- OAuth callback verifies Shopify HMAC before token exchange.
- OAuth callback validates signed `state` token and expected shop domain.
- Granted scopes must include all required app scopes from `SHOPIFY_SCOPES`.
- Offline tokens are stored encrypted (`shopify_connections.access_token_encrypted`).
- Plaintext OAuth token persistence in `sites.api_key` is disallowed.
