# Shopify Public App Integration Plan

Last updated: 2026-02-20

## Goal
Enable one-click Shopify connection and reliable blog publishing for many unrelated merchants using the public app route.

## Scope (MVP)
- Connect Shopify store from Acta UI
- Select default Shopify blog
- Publish posts to Shopify via Admin GraphQL
- Support scheduled auto-publishing
- Meet Shopify compliance webhook requirements

## Assumptions
- Distribution type: Public app
- Acta UI remains external (non-embedded) for v1
- API version pin target: `2026-01` (or latest stable at implementation time)

## Architecture Decision Note (2026-02-20)
- Public distribution remains the selected path (`App Store` distribution in Shopify app runtime config).
- OAuth source of truth remains backend-driven and external to Shopify Admin:
  - `POST /api/v1/shopify/install-url`
  - `GET /api/v1/shopify/callback`
- Acta v1 remains non-embedded (`embedded = false`) for OAuth and publishing workflows.

## Phase Status Snapshot
- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete
- Phase 4: Complete
- Phase 5: Not started
- Phase 6: In progress
- Phase 7: Not started

## Phase 1: Foundation
1. Finalize architecture decisions.
   - Confirm public distribution.
   - Confirm OAuth flow type for external app.
   - Confirm required scopes: `read_content`, `write_content`.
2. Create production app in Shopify Dev Dashboard.
   - Configure app URL, redirect URLs, support URL, privacy policy URL, terms URL.
3. Add app config (`shopify.app.toml`).
   - Scopes.
   - Compliance webhook topics:
     - `customers/data_request`
     - `customers/redact`
     - `shop/redact`

## Phase 2: Authentication and Connection
1. Backend install/auth endpoints.
   - `POST /shopify/install-url`
   - `GET /shopify/callback`
2. Security checks.
   - Validate `state` on callback.
   - Validate Shopify HMAC where required.
3. Token handling.
   - Exchange auth code for token.
   - Store offline token encrypted at rest.
4. Data model updates.
   - Add store connection entity (shop domain, token, scopes, status, timestamps, user/site link).

## Phase 3: Product UX
1. Replace manual Shopify credentials with connect UX.
   - Add `Connect Shopify` button in site form.
   - Show connection status.
2. Blog selection workflow.
   - Fetch blogs after successful connect.
   - Persist `default_blog_id`.
3. Re-enable Shopify in scheduling UI.
   - Allow Shopify sites in schedule site picker.
   - Remove Shopify "Coming Soon" visual treatment.

## Phase 4: Publishing Pipeline
1. Switch Shopify publishing to GraphQL.
   - Use `articleCreate`.
   - Handle and surface GraphQL `userErrors`.
2. Persist publish metadata.
   - Save platform article ID.
   - Save published URL if returned.
3. Failure handling.
   - Keep generated post if publish fails.
   - Notify user with actionable error message.

## Phase 5: Compliance and Lifecycle
1. Implement webhook endpoint for Shopify.
   - Raw body HMAC verification.
   - Return `401` on invalid signature.
2. Required privacy webhooks.
   - `customers/data_request`
   - `customers/redact`
   - `shop/redact`
3. Add uninstall handling.
   - Revoke/disconnect shop record.
   - Prevent publishes from disconnected stores.

## Phase 6: QA and Readiness
1. End-to-end QA scenarios.
   - Install/connect
   - Reconnect
   - Blog selection and save
   - Manual publish
   - Scheduled auto-publish
   - Uninstall/reinstall
2. Negative-path testing.
   - Invalid HMAC
   - Missing scopes
   - Token revoked
   - Invalid blog ID
3. Observability.
   - Structured logs for install callback, publish attempts, webhook processing.

## Phase 7: Review and Launch
1. Prepare App Store review artifacts.
   - Reviewer instructions
   - Test account details
   - Data handling notes
2. Submit app for review.
3. Address review findings.
4. Roll out behind feature flag, then GA.

## Suggested Timeline
- Week 1: Phases 1-2
- Week 2: Phases 3-5
- Week 3: Phases 6-7

## Deliverables Checklist
- [x] Public app configured
- [x] OAuth install flow working
- [x] Encrypted token storage in DB
- [x] Shopify site connect UI live
- [x] Blog selection and save live
- [x] GraphQL publish path live
- [ ] Compliance webhooks live
- [x] End-to-end QA pass complete (Phase 1-4 closeout scope)
- [ ] App review submission complete

## Acceptance Criteria
- Merchant can connect store from Acta with no manual token copy/paste.
- Merchant can choose a blog and publish a post successfully.
- Scheduler can auto-publish to Shopify when enabled.
- Invalid webhook signatures are rejected.
- Uninstalled stores cannot be published to.
