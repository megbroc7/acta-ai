# Shopify Dashboard Settings (Public App)

These values are managed in the Shopify Partner Dashboard (not in `shopify.app.toml`).

## Production URLs
- App URL: `https://app.actaai.com`
- Allowed redirection URL: `https://app.actaai.com/api/v1/shopify/callback`
- Support URL: `https://app.actaai.com/support`
- Privacy policy URL: `https://app.actaai.com/privacy`
- Terms of service URL: `https://app.actaai.com/terms`

## Notes
- Acta v1 runs as a non-embedded public app.
- OAuth callback source of truth is the Acta backend route:
  - `GET /api/v1/shopify/callback`
