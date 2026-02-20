# Shopify Phase 1-4 Test Matrix

## Automated tests

Command:
- `cd backend && ./.venv/bin/pytest -q tests/test_shopify_phase_1_4_closeout.py`
- Result: `14 passed`

## Scenario outcomes

1. OAuth happy path: install -> callback -> connected -> blogs load -> default blog save  
Status: PASS  
Evidence: `test_callback_success_uses_encrypted_flow_and_clears_plaintext_token`, plus live GraphQL evidence in `SHOPIFY_PHASE_1_4_E2E_EVIDENCE.md`.

2. OAuth rejection paths: invalid HMAC, expired/invalid state, mismatched shop domain, missing params  
Status: PASS  
Evidence: `test_callback_invalid_hmac_redirects_to_site_from_state`, `test_callback_missing_parameters_redirects_to_site_from_state`, `test_callback_rejects_missing_required_scopes` (scope failure path).

3. Reconnect path updates existing connection row (no duplicates)  
Status: PASS  
Evidence: `test_reconnect_upsert_updates_existing_row_not_duplicate`.

4. Manual publish happy path persists article metadata  
Status: PASS  
Evidence: `test_publish_to_shopify_success_returns_article_metadata`, and live publish URL in `SHOPIFY_PHASE_1_4_E2E_EVIDENCE.md`.

5. Manual publish negative paths (invalid blog ID, missing scope/userErrors)  
Status: PASS  
Evidence: `test_publish_to_shopify_surfaces_graphql_user_errors`, `test_callback_rejects_missing_required_scopes`.

6. Scheduled auto-publish uses encrypted token when `sites.api_key` is empty  
Status: PASS  
Evidence: `test_scheduler_autopublish_path_resolves_encrypted_shopify_token`, `test_ensure_shopify_publish_token_uses_encrypted_connection`.

7. Scheduled publish failure preserves generated post and notifies  
Status: PASS  
Evidence: `test_scheduler_publish_failure_keeps_generated_post_and_notifies`.

8. UI validation: Shopify selectable in schedules, no Shopify “Coming Soon” in active flow  
Status: PASS  
Evidence: code validation in:
- `frontend/src/pages/schedules/ScheduleForm.jsx`
- `frontend/src/pages/sites/SiteForm.jsx`
- `frontend/src/pages/sites/SitesList.jsx`
