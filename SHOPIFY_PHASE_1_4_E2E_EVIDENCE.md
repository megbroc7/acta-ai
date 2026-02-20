# Shopify Phase 1-4 E2E Evidence

Date captured: 2026-02-20 (UTC)  
Environment: local Acta backend + connected dev store (`acta-blog-dev.myshopify.com`)

## 1. DB row checks (pre-flight)

Command summary:
- Queried local Postgres for Shopify site + connection state.

Observed rows:
- `sites` count: `6`
- `shopify_connections` count: `1`
- Active Shopify site row:
  - `site_id`: `36126c9d-4e2d-4e07-8762-731b0527e09b`
  - `url`: `https://acta-blog-dev.myshopify.com`
  - `api_url`: `https://acta-blog-dev.myshopify.com/admin/api/2026-01`
  - `default_blog_id`: `125735862613`
  - `shop_domain`: `acta-blog-dev.myshopify.com`
  - `is_active`: `true`
  - `last_connected_at`: `2026-02-19T23:44:19.172872+00:00`

## 2. Request logs (GraphQL validation run)

Command summary:
- Decrypted the active stored token from `shopify_connections.access_token_encrypted`.
- Sent GraphQL `blogs` query.
- Sent GraphQL `articleCreate` mutation using configured default blog.

Observed request/response logs:
- `graphql_url`: `https://acta-blog-dev.myshopify.com/admin/api/2026-01/graphql.json`
- `blogs_status`: `200`
- `blogs_found`: `2`
- `blog_0`: `gid://shopify/Blog/125735862613` (`news`)
- `create_status`: `200`
- `created_article_id`: `gid://shopify/Article/613620613461`

## 3. Resulting public URL

- `https://acta-blog-dev.myshopify.com/blogs/news/acta-phase-1-4-closeout-validation-2026-02-20-08-15-54z`

## 4. Reproducibility notes

- This evidence run is reproducible with:
  - one active Shopify site row,
  - one active encrypted Shopify connection,
  - valid `default_blog_id`,
  - backend `ENCRYPTION_KEY` configured.
- No plaintext token output was logged during capture.
