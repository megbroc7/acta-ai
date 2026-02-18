# Changelog

All notable changes to Acta AI will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Next up
- Shopify/Wix publishing (currently "Coming Soon")
- Content pipeline P1-P6 all complete

---

## Session Log

### 2026-02-18 (Session 39) — FAQ Schema Auto-Generation, Unlisted Posts, Post Copy Buttons

**What we did:**
Three features that improve SEO automation and the copy-paste publishing workflow.

**1. FAQ Schema Auto-Generation** (`services/content.py`, `api/templates.py`, `PromptForm.jsx`, `PostDetail.jsx`)
- New always-on pipeline step after Review: one GPT-4o call extracts 3-5 Q&A pairs from the polished article
- Builds Schema.org `FAQPage` JSON-LD and appends it as an invisible `<script>` tag at the end of the HTML
- Helps posts appear in Google FAQ rich snippets and get cited by AI answer engines (ChatGPT, Perplexity, etc.)
- Non-fatal — if extraction fails, post generates normally without schema
- Progress bar updated: 6 base steps (was 5), new "FAQ" stage shown between Review and SEO Meta
- SSE `complete` event includes `faq_schema` field for frontend preview
- Frontend: collapsible bronze-accented FAQ Schema card (collapsed by default) with explanation text, shows Q&A pairs on expand. Appears in both test panel and PostDetail
- Cost: ~$0.01 per post (similar to charts step)

**2. Unlisted Posts / Optional Site** (`schemas/posts.py`, `models/blog_post.py`, `PromptForm.jsx`)
- `blog_posts.site_id` now nullable — posts can exist without being tied to a site
- Migration `796f1623951b`: `ALTER COLUMN site_id SET NULL`
- Save to Posts dialog: "Unlisted (no site)" option in site dropdown, save button no longer requires site selection
- All existing pages (PostsList, PostDetail, ReviewQueue) already handle null site via optional chaining

**3. Post Detail Copy Buttons** (`PostDetail.jsx`)
- Content card: "Copy as Markdown" and "Copy as HTML" buttons in header (strips FAQ schema script tag for clean output)
- Excerpt card: copy button added
- FAQ Schema card: copy button for raw JSON-LD script tag
- Markdown conversion via `turndown` library (new dependency)
- SEO metadata fields already had individual copy buttons (unchanged)

**Files changed:** `content.py`, `templates.py`, `blog_post.py`, `posts.py` (schema), `PromptForm.jsx`, `PostDetail.jsx`, `package.json`
**Migration:** `796f1623951b` — make `blog_posts.site_id` nullable
**New dependency:** `turndown` (frontend, HTML-to-Markdown)

---

### 2026-02-18 (Session 38) — Copy & Paste Platform, Save to Posts, Test Panel LinkedIn

**What we did:**
Added four interconnected features that close the gap for users on platforms without content APIs (Squarespace, Ghost, Webflow, etc.). No migration needed — Platform is validated at the Pydantic layer only.

**1. Copy & Paste Platform** (`schemas/sites.py`, `api/sites.py`, `services/publishing.py`, `services/scheduler.py`)
- New `Platform.copy` value — sites need only a name and blog URL, no credentials or API URL
- `SiteCreate.api_url` made optional (copy sites skip it; validator ensures it's present for WP/Shopify/Wix)
- Connection test returns instant success for copy sites
- `publish_to_copy()` returns `PublishResult(platform_post_id=f"copy-{post.id}", published_url=site.url)`
- Scheduler guard: auto-publish on copy sites overrides to `pending_review` (auto-publish is meaningless without an API)
- Frontend: SiteForm shows only Name + Blog URL for copy platform, with info Alert explaining the workflow

**2. Save to Posts** (`schemas/posts.py`, `pages/prompts/PromptForm.jsx`)
- `PostCreate` schema expanded with optional audit fields: `prompt_template_id`, `system_prompt_used`, `topic_prompt_used`, `content_prompt_used`
- New `SaveAlt` icon button in test panel Article Preview header bar
- Dialog with site selector dropdown (auto-selects if user has 1 site)
- Saves full content (HTML, excerpt, featured image, meta, audit trail, template link) as a draft BlogPost
- Success snackbar with "View Post" action navigating to PostDetail

**3. Mark as Published** (`schemas/posts.py`, `api/posts.py`, `pages/posts/PostDetail.jsx`)
- New `MarkPublishedRequest` schema with optional `published_url`
- New `POST /posts/{post_id}/mark-published` endpoint — validates copy platform, sets published status + URL
- PostDetail: detects `isCopyPlatform` — shows "Mark as Published" button instead of "Publish"
- Dialog with optional URL input field + "Confirm Published" button
- Review Decision Bar updated: "Approve & Mark Published" for copy sites (instead of "Approve & Publish")
- Existing "View Live" button reads `published_url` automatically

**4. LinkedIn in Test Panel** (`api/templates.py`, `pages/prompts/PromptForm.jsx`)
- New `POST /templates/{template_id}/test/linkedin` endpoint — tier-gated (Tribune+), maintenance guard, loads template for voice/industry
- Blue LinkedIn icon button in Article Preview header bar (only shown for saved templates)
- Full LinkedIn dialog: hook preview with char count, full post TextField, "Your Voice" chip, Regenerate + Copy to Clipboard
- Same design as PostDetail LinkedIn dialog — consistent UX across both entry points

**Files changed:** 11 (7 backend, 3 frontend + content.py pre-existing tweaks)

---

### 2026-02-18 (Session 37) — LinkedIn Repurpose Feature

**What we did:**
Added on-demand LinkedIn post generation from PostDetail. Users can convert any blog post into a ~1300-character LinkedIn post optimized for the 2026 algorithm, copy it to clipboard, and paste it into LinkedIn. Tribune+ only (tier-gated). No new models, no migrations.

**1. Content Service** (`services/content.py`)
- `repurpose_to_linkedin(content_html, title, industry)` — converts HTML to plain text via `markdownify`, one GPT-4o call with LinkedIn-specific prompt
- `_linkedin_tone_for_industry(industry)` — three-tier tone calibration: AI-friendly industries (leadership, coaching, HR) get polished tone; AI-hostile industries (marketing, strategy, healthcare, legal, finance) get aggressive anti-AI constraints requiring specific details from the article; default gets moderate guidance
- Prompt enforces: Hook-Story-Payoff structure with 150-char hook awareness (LinkedIn truncation point), BANNED_PHRASES injection (all 83 phrases), sentence dynamics (vary length, active voice, contractions, minimize adverbs), mobile formatting (1-3 sentences per paragraph, blank lines), no em dashes, no external links (20-30% reach penalty), specific open-ended CTA (never yes/no), max 3 hashtags

**2. Tier Gating** (`services/tier_limits.py`)
- Added `repurpose_linkedin: False` to Scriptor, `True` to Tribune and Imperator
- Added "Repurpose to LinkedIn" label in `check_feature_access()`

**3. API Endpoint** (`api/posts.py`)
- `POST /{post_id}/repurpose-linkedin` — tier gate, maintenance mode guard, loads template industry for tone calibration, returns `{ linkedin_post: str }`

**4. Frontend** (`pages/posts/PostDetail.jsx`)
- LinkedIn button (blue #0A66C2) in top action bar, visible for all posts
- Dialog with: loading spinner, hook preview box (first line highlighted with X/150 char count, green/sienna indicator, context about "See more" truncation), full post in read-only TextField, total character count chip, Regenerate button, Copy to Clipboard button
- Regenerate fires a new API call without closing the dialog

**Files changed:** `content.py`, `tier_limits.py`, `posts.py`, `PostDetail.jsx`, `PromptForm.jsx` (blockquote styling fix)

---

### 2026-02-18 (Session 36) — Web Research Pipeline Step

**What we did:**
Added an optional web research step to the AI content pipeline. When enabled on a template, the system uses OpenAI's Responses API with the `web_search` tool to find 3-5 current statistics, data points, and research findings *before* writing begins. These findings are injected into both the outline and draft prompts, and cited in a Sources section at the end of each article.

**1. OpenAI SDK Upgrade** (`requirements.txt`)
- Bumped `openai` from `1.51.0` to `>=1.75.0,<2.0.0` (installed v1.109.1)
- Required for the Responses API (`client.responses.create()`)

**2. Database & Model** (migration `o4p5q6r7s8t9`, `prompt_template.py`, `templates.py`)
- Added `web_research_enabled` (Boolean, nullable, default false) to `prompt_templates`
- Added field to `TemplateCreate`, `TemplateUpdate`, `TemplateResponse` schemas

**3. Content Pipeline** (`services/content.py`)
- New constants: `WEB_SEARCH_COST = $0.03`, `RESEARCH_TIMEOUT = 45s`, `RESEARCH_MAX_TOKENS = 2000`
- `_call_openai_responses()` — Responses API caller with `web_search` tool, retry logic, citation extraction from `url_citation` annotations, maps `input_tokens`/`output_tokens` to existing `OpenAIResponse` dataclass
- `_generate_web_research()` — Finds 3-5 recent stats/facts for the article topic. Non-fatal (returns None on failure)
- `_format_sources_section()` — Formats citations as markdown `## Sources` with linked titles
- `_generate_outline()` — New `research_context` param; when provided, appends `<research>` block telling AI to incorporate findings into Data Marker slots
- `generate_content()` — New `web_research_enabled` param. Dynamic step counting: `5 + research? + image?` (5/6/7 steps). Research runs as step 1, context injected into outline and draft prompts, citations appended after review step
- `generate_post()` — Passes `web_research_enabled=bool(template.web_research_enabled)`

**4. Tier Gating** (`services/tier_limits.py`)
- Added `web_research: False` to Scriptor, `True` to Tribune and Imperator
- Added "Web Research" label to `check_feature_access()`

**5. API Endpoint** (`api/templates.py`)
- SSE `test_content_stream`: tier check when research enabled, passes `web_research_enabled` to pipeline
- Progress callback enriched with `has_research` and `has_image` kwargs so frontend can build stages dynamically

**6. Scheduler** (`services/scheduler.py`)
- Imported `WEB_SEARCH_COST`, added to cost estimation when `template.web_research_enabled`

**7. Frontend** (`PromptForm.jsx`)
- Web Research toggle on Defaults tab (Switch + tooltip) after Featured Image section
- Form state + edit population for `web_research_enabled`
- Dynamic progress bar: `RESEARCH_STAGE` prepended when `progress.has_research` is true, `IMAGE_STAGE` appended when `progress.has_image` is true (replaces old `total > 5` heuristic)

**Migration:** `o4p5q6r7s8t9` — adds `web_research_enabled` to `prompt_templates`

**Files changed:** 9 modified + 1 new (migration)

---

### 2026-02-18 (Session 35) — Data Visualization in Blog Posts

**What we did:**
Added automatic chart and table generation to the content pipeline. The system now scans every draft for statistics, comparisons, and rankings, then renders them as pure inline-CSS HTML visualizations embedded directly in the post. Works everywhere — Acta AI preview, WordPress, Shopify, email.

**1. Chart Extraction & Rendering** (`services/content.py`)
- New `_extract_chart_data()` — one GPT-4o call (temp 0.3) scans the draft for chartable data, returns 0-2 structured JSON specs
- `_render_bar_chart()` — horizontal or vertical bar charts with percentage-width bars scaled to max value
- `_render_table()` — zebra-striped tables with optional highlight column
- `_render_chart_html()` — dispatcher routing to the correct renderer by type
- Design system colors: patina green `#4A7C6F` bars, bronze `#B08D57` value labels, warm stone `#FAF8F5` background, `#E0DCD5` borders, bronze left-border accent (carved stone tablet aesthetic)
- Always-on, opportunistic — no per-template toggle. 0 charts is fine.
- Two-phase architecture: AI extracts structured JSON spec → Python renders pixel-perfect HTML. AI never writes CSS.

**2. Draft Injection** (`services/content.py`)
- `_inject_charts_into_draft()` — finds H2 heading matching `insert_after_heading` (case-insensitive partial match), inserts HTML block after first paragraph under that heading
- Processes in reverse document order to avoid index shifting
- Fallback: appends at end if heading not found

**3. Pipeline Wiring** (`services/content.py`)
- New flow: Outline(1) → Draft(2) → **Charts(3)** → Review(4) → Meta(5) → [Image(6)]
- `total_steps` updated: `6 if has_image else 5`
- Chart step fully wrapped in try/except — non-fatal, draft continues unchanged on failure
- Token tracking: passes `TokenAccumulator` to `_extract_chart_data()`

**4. Review Rubric Update** (`services/content.py`)
- Added Priority 1 item: "Preserve all `<div>` HTML blocks (charts/tables) exactly as-is — do NOT modify, rewrite, or remove them"

**5. Frontend Progress Bar** (`PromptForm.jsx`)
- Added `{ key: 'charts', label: 'Charts' }` to `BASE_PIPELINE_STAGES` after 'draft'
- Updated image stage threshold: `progress.total > 4` → `progress.total > 5`

**No migration. No schema changes. No new files. No new dependencies.**

**Files changed:** 2 modified (`content.py`, `PromptForm.jsx`)

---

### 2026-02-18 (Session 34) — Billing & Subscription Tiers (Session 3 of 3): Scheduler Guards, DALL-E HD, Admin Panel, Trial Notifications

**What we did:**
Completed the billing/subscription feature with 4 remaining pieces: scheduler-level subscription enforcement, tier-aware DALL-E image quality, admin billing visibility panel, and proactive trial expiry notifications.

**1. Scheduler Subscription Guard** (`services/scheduler.py`)
- After loading a schedule, loads the `User` and calls `get_effective_tier()`
- If tier is `None` (expired trial + no subscription) → auto-deactivates the schedule, removes APScheduler job, creates a billing notification, returns early with no AI cost incurred
- New `create_subscription_expired_notification()` helper in `notifications.py`

**2. DALL-E HD Quality per Tier** (`images.py`, `content.py`, `scheduler.py`, `templates.py`)
- `generate_featured_image()` and `_generate_dalle_image()` now accept a `quality` parameter ("standard" or "hd")
- `generate_content()` and `generate_post()` gain a `dalle_quality` parameter, threaded to the image service
- Scheduler looks up `TIER_LIMITS[tier]["dalle_quality"]` — Imperator gets HD ($0.08), Tribune gets standard ($0.04), Scriptor has no DALL-E access
- `test_content_stream` SSE endpoint also looks up tier quality
- Added `DALLE3_HD_COST = 0.08` constant; scheduler uses correct cost for execution history

**3. Admin Billing Panel** (`api/admin.py`, `schemas/admin.py`, `AdminBilling.jsx`)
- New `GET /admin/subscriptions` endpoint — LEFT JOINs users with subscriptions table
- Returns: user info, subscription_tier, trial_ends_at, trial_active (computed), effective_tier (computed), subscription status, period end, cancel_at_period_end
- Sorted: active subscribers first → trialing → expired
- New `AdminBilling.jsx` page: tier badges (green/bronze/grey), status chips, period end, trial status, cancellation indicators
- Route at `/admin/billing`, "Billing" with Payment icon in admin sidebar

**4. Trial Expiry Notifications** (`scheduler.py`, `notifications.py`, `NotificationCenter.jsx`)
- New `check_trial_expirations()` — queries trial users, checks days_remaining in {3, 1, 0}
- Deduplicates: checks for existing notification with same title + category created today
- 3 messages: "Your trial ends in 3 days", "Your trial ends tomorrow", "Your free trial has ended" — all link to `/settings`
- Wired into `start_scheduler()`: runs once on startup + daily APScheduler cron job at 09:00 UTC
- Added `billing` category with Payment icon in `NotificationCenter.jsx`

**No migration needed** — all DB columns exist from Sessions 32-33.

**Files changed:** 10 modified + 1 new

**Billing feature is now COMPLETE (3/3 sessions).** All tiers fully enforced end-to-end: resource limits, feature gates, scheduler guards, image quality, Stripe checkout/portal/webhooks, admin visibility, trial notifications.

---

### 2026-02-18 (Session 33) — Billing & Subscription Tiers (Session 2 of 3): Stripe Integration + Frontend

**What we did:**
Wired Stripe Checkout, Customer Portal, and Webhooks into the backend. Built the subscription UI as a section inside the Settings page — current plan badge, usage bars, trial alerts, plan comparison grid with Stripe checkout/portal integration.

**1. Stripe Package + Config**
- Added `stripe>=11.0.0` to `requirements.txt` (installed v14.3.0)
- Added 5 Stripe settings to `config.py`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SCRIPTOR`, `STRIPE_PRICE_TRIBUNE`, `STRIPE_PRICE_IMPERATOR`
- Installed Stripe CLI (`/tmp/stripe`) for local webhook forwarding

**2. Stripe Service** (`services/stripe_service.py`) — NEW
- `get_or_create_customer(user, db)` — finds or creates Stripe customer, persists `stripe_customer_id`
- `create_checkout_session(user, tier, success_url, cancel_url, db)` — maps tier → price ID, creates Stripe Checkout Session (mode=subscription)
- `create_portal_session(user, return_url, db)` — creates Stripe Customer Portal session
- `handle_webhook_event(payload, sig_header, db)` — verifies signature, dispatches to 4 handlers:
  - `checkout.session.completed` → upserts Subscription row, sets `user.subscription_tier`, clears trial
  - `customer.subscription.updated` → syncs status/tier/period/cancel_at_period_end
  - `customer.subscription.deleted` → marks canceled, clears `user.subscription_tier`
  - `invoice.payment_failed` → sets status to "past_due"
- Uses async Stripe API variants (`create_async`, `retrieve_async`) to avoid blocking the event loop
- Helper functions: `_price_to_tier()`, `_tier_to_price()`, `_from_unix()`

**3. Billing Schemas** (`schemas/billing.py`)
- Added `CheckoutSessionRequest`, `CheckoutSessionResponse`, `PortalSessionRequest`, `PortalSessionResponse`, `SubscriptionDetail`
- Extended `TierInfoResponse` with optional `subscription` field (status, current_period_end, cancel_at_period_end)

**4. Billing API Endpoints** (`api/billing.py`)
- `POST /billing/create-checkout-session` — creates Stripe Checkout; if user already has subscription, redirects to portal instead
- `POST /billing/create-portal-session` — creates Customer Portal session
- `POST /billing/webhook` — no auth, raw body + Stripe signature verification, own DB session
- Extended `GET /billing/tier-info` to include subscription details

**5. Frontend — Subscription in Settings** (`pages/settings/Settings.jsx`)
- Subscription section added as first card in Settings page (no separate nav item)
- Current plan badge + trial countdown chip + cancellation chip
- Usage bars (sites/templates/schedules) with LinearProgress
- 3-column plan comparison grid (Scriptor/Tribune/Imperator) with features, excluded features, prices
- Smart button labels: "Current Plan" (disabled) / "Subscribe" / "Upgrade" / "Manage Plan"
- "Manage Subscription" button → Stripe Customer Portal
- `/billing` route redirects to `/settings` (handles Stripe return URLs)
- Success/cancel URL handling: reads query params, shows snackbar, cleans URL

**No migration needed** — all DB schema was established in Session 32.

**Session 3 TODO:** Scheduler guards, DALL-E HD quality per tier, admin billing panel, trial expiry notifications.

**Files changed:** 6 modified + 1 new

---

### 2026-02-18 (Session 32) — Billing & Subscription Tiers (Session 1 of 3)

**What we did:**
Built the data foundation and backend enforcement for three subscription tiers: Scriptor ($29/mo), Tribune ($79/mo), and Imperator ($249/mo). This is Session 1 of 3 — establishes tier definitions, database models, resource limit enforcement, feature gates, trial logic, and a tier info API. Stripe integration (Session 2) and frontend UI (Sessions 2-3) come later.

**1. Database: User model** (`models/user.py`)
- Added `subscription_tier` (String(20), nullable) — "scriptor" / "tribune" / "imperator" / NULL
- Added `trial_ends_at` (DateTime(timezone=True), nullable) — set to now + 14 days on registration
- Added `stripe_customer_id` (String(255), nullable) — placeholder for Session 2

**2. Database: Subscription model** (`models/subscription.py`) — NEW
- One-per-user table for Stripe subscription data (customer ID, subscription ID, price ID, status, tier, period dates, cancel_at_period_end, trial dates, timestamps)
- Stays empty until Session 2 (Stripe webhooks) — created now for clean migration

**3. Migration `n3o4p5q6r7s8`**
- Creates `subscriptions` table with indexes on stripe_customer_id and stripe_subscription_id
- Adds 3 columns to `users`
- Data migration: all existing users grandfathered as `imperator` (no trial, no expiry)

**4. Tier Enforcement Service** (`services/tier_limits.py`) — NEW
- `TIER_LIMITS` dict: resource caps (sites/templates/schedules), feature flags (review_workflow, voice_match, revise_with_ai, wp_pending_review), image sources, DALL-E quality
- `get_effective_tier(user)` — subscription_tier → active trial ("tribune") → None (soft-locked)
- `check_site_limit()`, `check_template_limit()`, `check_schedule_limit()` — count + enforce 403
- `check_feature_access()` — boolean feature gates with descriptive upgrade messages
- `check_image_source()` — validates DALL-E vs Unsplash per tier
- `require_active_subscription()` — blocks expired trial + no subscription

**5. Backend Enforcement Wiring**
- `auth.py`: New users get `trial_ends_at = now + 14 days` (Tribune-level trial)
- `sites.py`: `create_site()` → site limit check
- `templates.py`: `create_template()` / `duplicate_template()` → template limit check; `create`/`update` → image source validation; `analyze_voice()` → voice_match feature gate; `test_content_stream()` → active subscription + image source check
- `schedules.py`: `create_schedule()` → schedule limit check + review workflow gate on post_status; `update_schedule()` → review workflow gate; `activate_schedule()` → require_active_subscription
- `posts.py`: `revise_stream()` → revise_with_ai feature gate

**6. Billing API** (`api/billing.py`) — NEW
- `GET /billing/tier-info` — returns effective tier, subscription tier, trial status, limits dict, and current usage counts (sites/templates/schedules)
- `TierInfoResponse` / `TierLimitsResponse` / `UsageResponse` schemas

**7. Auth Schema** (`schemas/auth.py`)
- `UserResponse` now includes `subscription_tier`, `trial_ends_at`, and computed `trial_active` field

**Files changed:** 10 modified + 4 new
**Migration:** `n3o4p5q6r7s8`
**Deferred to Session 2:** Stripe Checkout, webhooks, Customer Portal, frontend pricing page, frontend billing settings, TierGate component
**Deferred to Session 3:** Scheduler tier guards, DALL-E HD quality, admin subscription panel, trial expiry notifications

---

### 2026-02-18 (Session 31) — Match My Writing Style

**What we did:**
Added a "Match My Writing Style" feature to the Voice & Tone tab. Users can paste a writing sample, click "Analyze My Voice," and the AI detects their tone, personality level, perspective, brand voice description, and stylistic switches (contractions, anecdotes, rhetorical questions, humor). The two modes — AI-detected and manual — are mutually exclusive via a toggle. No changes to the content generation pipeline since the feature populates the same existing voice fields.

**1. AI Voice Analysis** (`services/content.py`)
- New `analyze_writing_voice()` function — sends writing sample to GPT-4o (temp 0.3) requesting structured JSON output
- Truncates input to 5,000 words to keep costs reasonable (~$0.02-0.03 per analysis)
- Validates and clamps all returned values against allowed lists (tone, perspective, personality 1-10)
- Uses existing `_call_openai()` and `_strip_code_fences()` patterns
- Returns confidence level ("low"/"medium"/"high") and plain-English summary

**2. API Endpoint** (`api/templates.py`)
- `POST /templates/{id}/analyze-voice` — accepts `VoiceAnalysisRequest` (writing_sample, min 50 chars, max 50k)
- Returns `VoiceAnalysisResponse` with all detected voice fields + confidence + summary
- Maintenance mode guard, template ownership check
- `duplicate_template` updated to copy `writing_sample` and `voice_match_active`

**3. Database: migration `m2n3o4p5q6r7`**
- `writing_sample` (Text, nullable) — stores raw pasted text
- `voice_match_active` (Boolean, nullable, server_default='false') — whether AI-detected voice mode is active

**4. Frontend** (`PromptForm.jsx`)
- Mode toggle box at top of Voice & Tone tab with `AutoFixHigh` icon — patina green border when active
- Collapsible writing sample textarea (8 rows) with live word counter and 4 quality tiers:
  - Under 500 words: amber "Short sample — basic detection"
  - 500-1,499: green "Good sample length"
  - 1,500-3,000: dark green "Great — accurate voice detection"
  - 3,000+: dark green "Excellent — highly accurate detection"
- "Analyze My Voice" button with loading spinner
- Success alert showing confidence level + plain-English summary of detected style
- All voice controls (tone, personality, perspective, brand voice, 4 switches) become `disabled` when active
- Phrases to Avoid and Preferred Terms remain always editable (user vocabulary, not detectable from sample)
- Toggle OFF: controls become editable, values persist for manual tweaking

**Files changed:**
- `backend/app/models/prompt_template.py` — 2 new columns (writing_sample, voice_match_active)
- `backend/app/schemas/templates.py` — fields on Create/Update/Response + VoiceAnalysisRequest/Response schemas
- `backend/app/services/content.py` — `analyze_writing_voice()` function + constants
- `backend/app/api/templates.py` — analyze-voice endpoint + duplicate update + schema imports
- `frontend/src/pages/prompts/PromptForm.jsx` — mode toggle, writing sample UI, analysis handler, read-only controls

**Files created:**
- `backend/migrations/versions/m2n3o4p5q6r7_add_voice_match_fields.py`

**Open bugs:** None identified this session.

---

### 2026-02-17 (Session 28) — Error Resilience & User Feedback

**What we did:**
Added an error classification system, in-app notification center, enhanced dashboard "Needs Attention" card, and paginated execution history with a dedicated full-page view. No more silent failures — users now get classified errors with actionable guidance delivered through a bell-icon notification center in the AppBar.

**1. Error Classification System** (`services/error_classifier.py`)
- `ErrorClassification` dataclass: `category`, `user_title`, `user_guidance`, `is_transient`
- 11 categories: `api_rate_limit`, `api_auth`, `api_quota`, `api_timeout`, `publish_auth`, `publish_connection`, `publish_timeout`, `content_error`, `image_error`, `config_error`, `unknown`
- `classify_error(error_message)` — substring pattern matching (order-sensitive for specificity)
- `get_guidance(category)` — returns full classification with user-friendly title and actionable advice
- `error_category` column added to `ExecutionHistory` model (String(30), nullable)

**2. In-App Notification Center** (`NotificationCenter.jsx`)
- Bell icon with bronze badge in AppBar (between email and avatar)
- MUI Popover with notification list: category-specific icons, bold unread titles, truncated messages, relative timestamps, action buttons
- "Mark all read" link in header
- Polls `GET /notifications/unread-count` every 60s (same pattern as maintenance status)
- Click: marks as read + navigates to `action_url`
- Backend: `Notification` model with user_id, category, title, message, action_url/label, is_read, schedule_id FK, execution_id FK
- 4 API endpoints: `GET /notifications/`, `GET /notifications/unread-count`, `POST /{id}/read`, `POST /mark-all-read`
- Index on `(user_id, is_read)` for fast badge count

**3. Automatic Notification Creation** (`services/notifications.py`)
- `create_failure_notification()` — on every schedule failure, includes error guidance + truncated raw error
- `create_deactivation_notification()` — urgent notification when schedule auto-pauses after 3 failures
- `create_publish_failure_notification()` — when publishing fails but post saved as draft, action links to post
- All wired into `scheduler.py` `_record_failure()` and publish error path

**4. Enhanced Dashboard "Needs Attention"** (`Dashboard.jsx`)
- Fetches from new `GET /schedules/attention` endpoint (replaces client-side filter)
- Shows per-schedule: name, PAUSED chip if inactive, retry count, error category chip (sienna), guidance text
- Contextual action buttons: "Edit Site" (for publish_auth/connection), "Edit Schedule", "View History"
- Backend: `AttentionScheduleResponse` schema with joined Site name and enriched error guidance

**5. Paginated Execution History**
- `GET /{schedule_id}/executions` now returns `PaginatedExecutionResponse` with `total` + `entries`
- `success_filter` query param: `success`, `failure`, or all
- `SchedulesList.jsx`: handles new response shape, shows `error_category` chip on failures, "View Full History (N total)" link
- New `ScheduleHistory.jsx` page at `/schedules/:id/history`: full MUI Table with time, status chip, type, duration, error category chip, error message tooltip. Filter chips (All/Successes/Failures). Pagination (20/page). Failed rows with light sienna background.

**6. Admin Feedback Log** (from prior session work)
- `GET /admin/feedback` endpoint with pagination, date filter, category filter
- `AdminFeedback.jsx` + `FeedbackLog.jsx` pages
- Added to admin sidebar nav

**Database: migration `l1m2n3o4p5q6`**
- `error_category` String(30) nullable column on `execution_history`
- `notifications` table with index on `(user_id, is_read)`

**Files created:**
- `backend/app/services/error_classifier.py`
- `backend/app/models/notification.py`
- `backend/app/schemas/notifications.py`
- `backend/app/services/notifications.py`
- `backend/app/api/notifications.py`
- `backend/migrations/versions/l1m2n3o4p5q6_add_error_category_and_notifications.py`
- `frontend/src/components/common/NotificationCenter.jsx`
- `frontend/src/pages/schedules/ScheduleHistory.jsx`
- `frontend/src/pages/admin/AdminFeedback.jsx`
- `frontend/src/pages/admin/components/FeedbackLog.jsx`

**Files changed:**
- `backend/app/models/__init__.py` — Notification export
- `backend/app/models/blog_post.py` — error_category on ExecutionHistory
- `backend/app/schemas/schedules.py` — error_category, PaginatedExecutionResponse, AttentionScheduleResponse
- `backend/app/schemas/admin.py` — AdminFeedbackEntry, AdminFeedbackResponse
- `backend/app/services/scheduler.py` — classify + notify on failure, deactivation, publish error
- `backend/app/api/schedules.py` — attention endpoint, paginated executions with filter
- `backend/app/api/admin.py` — feedback log endpoint
- `backend/app/main.py` — notifications router
- `frontend/src/App.jsx` — ScheduleHistory route, AdminFeedback route
- `frontend/src/components/layouts/MainLayout.jsx` — NotificationCenter in AppBar, Feedback in admin nav
- `frontend/src/pages/dashboard/Dashboard.jsx` — enriched Needs Attention card
- `frontend/src/pages/schedules/SchedulesList.jsx` — paginated executions, category chips, history link

**Open bugs:** None identified this session.

---

### 2026-02-17 (Session 27) — AI Spend Controls & Admin Sub-Pages

**What we did:**
Added real OpenAI token tracking across the entire content pipeline, per-user cost breakdowns, and a global maintenance mode kill-switch. Also refactored the admin dashboard from a single page with stacked panels into a proper sub-page navigation with expandable sidebar menu.

**1. Token Tracking** (`services/content.py`)
- New `OpenAIResponse` dataclass captures `prompt_tokens`, `completion_tokens`, `total_tokens` from every OpenAI call
- `TokenAccumulator` aggregates costs across multi-step pipeline stages
- `_call_openai()` return type changed from `str` → `OpenAIResponse`; all 9 call sites updated
- Token fields added to `TitleResult`, `ContentResult`, `RevisionResult`, `GenerationResult` dataclasses
- GPT-4o pricing constants: `$2.50/1M input`, `$10.00/1M output`, `$0.04/DALL-E 3 image`

**2. Database: migration `k0l1m2n3o4p5`**
- 5 new columns on `execution_history`: `prompt_tokens`, `completion_tokens`, `total_tokens`, `estimated_cost_usd`, `image_cost_usd` (all nullable — old rows use flat-rate fallback)
- New `app_settings` table (single-row config): `maintenance_mode`, `maintenance_message`, `updated_at`, `updated_by`

**3. Cost Storage** (`services/scheduler.py`)
- `execute_schedule()` now stores token counts + calculated USD cost on each `ExecutionHistory` row
- Image cost tracked separately (`$0.04` for DALL-E, `$0` otherwise)

**4. Maintenance Mode**
- `services/maintenance.py` — `is_maintenance_mode()` + `get_maintenance_status()` helpers
- Scheduler guard: silently skips execution when maintenance active (no ExecutionHistory recorded)
- API guards on 3 endpoints (`test_content_stream`, `trigger_schedule`, `revise_stream`) — return 503
- `GET /api/v1/system/maintenance-status` — lightweight authenticated endpoint for frontend polling
- Frontend: sienna `Alert` banner in `MainLayout.jsx` (polls every 60s, visible to all users)

**5. Per-User Cost Breakdown** (`UserCostBreakdown.jsx`)
- `GET /admin/user-costs?days=N` — JOINs ExecutionHistory with User, GROUP BY user
- Sortable table: User, Executions, Tokens, Text Cost, Image Cost, Total
- Footer row with totals, top spender highlighted in bronze

**6. Admin Dashboard Toggle** (`MaintenanceToggle.jsx`)
- Prominent panel with large MUI Switch — sienna ON / green OFF
- Warning alert listing what's blocked when active
- `POST /admin/maintenance/toggle` flips the flag, records who + when

**7. Cost Chart Update**
- `CostEstimateChart` title changed from "Estimated AI Cost" → "AI Spend (Monthly)"
- Dashboard cost query now uses real tracked costs with flat-rate fallback for pre-migration rows

**8. Admin Sub-Page Refactor**
- Operations panels (Error Log, User Management, Schedule Oversight, Cost Breakdown) moved to dedicated sub-pages
- 4 new page wrappers: `AdminSchedules.jsx`, `AdminErrors.jsx`, `AdminUsers.jsx`, `AdminCosts.jsx`
- `MainLayout.jsx` updated with expandable sidebar sub-menu using MUI `Collapse`
- `ADMIN_CHILDREN` constant with 5 items (Overview, Schedules, Error Log, Users, Costs)
- Admin icon click: navigates to `/admin` when collapsed, toggles sub-menu when expanded
- `AdminDashboard.jsx` stripped to charts + maintenance toggle only
- 4 new routes in `App.jsx` with `AdminRoute` wrapper

**Schemas added:** `UserCostEntry`, `MaintenanceStatus`
**Fields added to existing `AdminDashboardResponse`:** `maintenance_mode`

**Files created:**
- `backend/app/models/app_settings.py`
- `backend/app/services/maintenance.py`
- `backend/migrations/versions/k0l1m2n3o4p5_add_spend_controls.py`
- `frontend/src/pages/admin/AdminSchedules.jsx`
- `frontend/src/pages/admin/AdminErrors.jsx`
- `frontend/src/pages/admin/AdminUsers.jsx`
- `frontend/src/pages/admin/AdminCosts.jsx`
- `frontend/src/pages/admin/components/MaintenanceToggle.jsx`
- `frontend/src/pages/admin/components/UserCostBreakdown.jsx`

**Files changed:**
- `backend/app/models/blog_post.py` — 5 cost columns on ExecutionHistory
- `backend/app/models/__init__.py` — AppSettings export
- `backend/app/services/content.py` — OpenAIResponse, TokenAccumulator, all 9 call sites + dataclasses
- `backend/app/services/scheduler.py` — maintenance guard + cost storage
- `backend/app/schemas/admin.py` — 2 new schemas + maintenance_mode on dashboard response
- `backend/app/api/admin.py` — 3 new endpoints + updated cost query
- `backend/app/api/templates.py` — maintenance guard
- `backend/app/api/schedules.py` — maintenance guard
- `backend/app/api/posts.py` — maintenance guard
- `backend/app/main.py` — public maintenance-status endpoint
- `frontend/src/App.jsx` — 4 new admin sub-routes
- `frontend/src/components/layouts/MainLayout.jsx` — expandable admin sub-menu + maintenance banner
- `frontend/src/pages/admin/AdminDashboard.jsx` — stripped operations panels
- `frontend/src/pages/admin/components/CostEstimateChart.jsx` — title update

**Open bugs:** None identified this session.

---

### 2026-02-17 (Session 26) — Admin User Management, Error Log & Schedule Oversight

**What we did:**
Transformed the read-only admin dashboard into a full platform operations center. Added user management controls (toggle active/admin, reset password, delete with cascade, drill-down detail), a global error log with pagination and date filtering, and a schedule oversight panel to monitor and pause/resume any user's schedules.

**1. User Management** (`UserManagement.jsx` replaces `UserActivityTable.jsx`)
- **Status chip** (green Active / sienna Inactive) — click to toggle, disabled for own row
- **Role chip** (bronze Admin / grey User) — click to toggle, disabled for own row
- **Reset Password** — confirmation dialog → generates temp password via `secrets.token_urlsafe(12)` → result dialog with copy-to-clipboard
- **Delete User** — confirmation dialog with cascade warning, removes user + all their data
- **Expandable detail row** — lazy-loads `GET /admin/users/{id}/detail`: 4-column grid (Sites, Templates, Schedules, Recent Posts) + sienna-tinted Recent Errors section
- Backend: 5 new endpoints (`toggle-active`, `toggle-admin`, `delete`, `reset-password`, `detail`) all with self-guards (can't modify your own account)
- 8 new schemas in `admin.py`

**2. Global Error Log** (`ErrorLog.jsx`)
- Own date range selector (7/30/90 days), independent of dashboard period
- Paginated table (20/page) with prev/next controls
- Columns: Time, User (name + email), Schedule name, Type chip (scheduled/manual), Error message (truncated with full monospace tooltip on hover)
- Sienna-tinted border when errors present, count chip
- Backend: `GET /admin/errors` with `days`/`limit`/`offset` params, joins ExecutionHistory with User + BlogSchedule

**3. Schedule Oversight** (`ScheduleOversight.jsx`)
- Table of all schedules across all users with joined context
- Columns: Schedule name, Owner (name + email), Site (name + platform chip), Template (name + industry), Frequency chip, Next Run (with relative time — "in 3h 12m" or red "overdue"), Last Run, Status toggle
- Active-only filter switch + count chips (active / total)
- Clickable status chip to pause/resume — mirrors user-facing activate/deactivate logic exactly (experience notes validation, scheduler job sync, next_run computation)
- Backend: `GET /admin/schedules` with `active_only` filter, `PATCH /admin/schedules/{id}/toggle-active`

**4. Dashboard layout reorganization**
- Charts grid on top (6 chart cards)
- Operations section below: Schedule Oversight → Error Log → User Management (stacked, each with own data source)

**Schemas added:** `AdminUserResponse`, `AdminPasswordResetResponse`, `AdminUserSite`, `AdminUserTemplate`, `AdminUserSchedule`, `AdminUserPost`, `AdminUserError`, `AdminUserDetail`, `ErrorLogEntry`, `ErrorLogResponse`, `ScheduleOversightEntry`
**Fields added to existing `UserActivity`:** `is_active`, `is_admin`, `created_at`

**Files created:**
- `frontend/src/pages/admin/components/UserManagement.jsx`
- `frontend/src/pages/admin/components/ErrorLog.jsx`
- `frontend/src/pages/admin/components/ScheduleOversight.jsx`

**Files changed:**
- `backend/app/schemas/admin.py` — 11 new schemas + 3 fields on UserActivity
- `backend/app/api/admin.py` — updated dashboard query, 8 new endpoints (5 user mgmt + 1 error log + 2 schedule oversight)
- `frontend/src/pages/admin/AdminDashboard.jsx` — swapped imports, reorganized layout

**Files deleted:**
- `frontend/src/pages/admin/components/UserActivityTable.jsx` — superseded by UserManagement

**Open bugs:** None identified this session.

---

### 2026-02-16 (Session 25) — SEO Meta Titles, Meta Descriptions & Image Alt Tags

**What we did:**
Added an AI-powered SEO metadata generation step to the content pipeline. Every article now gets a meta title, meta description, and (when images are enabled) image alt text — generated using 2026 SEO best practices for both traditional search engines and AI answer engines. Metadata is stored on each blog post, displayed with copy buttons and character count indicators in the UI, and published to WordPress via Yoast, RankMath, and native excerpt fields simultaneously.

**1. Database: migration `i8j9k0l1m2n3`**
- Added 3 nullable columns to `blog_posts`: `meta_title` (String 200), `meta_description` (String 500), `image_alt_text` (String 300)
- Model updated with corresponding `Mapped` fields after `featured_image_url`

**2. Content pipeline: new SEO meta step** (`services/content.py`)
- New constants: `META_TIMEOUT = 20`, `META_MAX_TOKENS = 500`
- New `SeoMetaResult` dataclass (meta_title, meta_description, image_alt_text)
- New `_generate_seo_meta(title, excerpt, industry, focus_keyword, image_source)` — calls OpenAI (temp 0.4) with prompt encoding 2026 SEO research:
  - **Meta title** (50-60 chars): entity-rich "Who + What + Context" pattern, power words, NOT identical to H1
  - **Meta description** (140-160 chars): atomic answer (~120 chars AI engines can cite) + value tease (~40 chars requiring click-through), no generic CTAs
  - **Image alt text** (~100-125 chars): descriptive, keyword-relevant, no "Image of" prefix
- New `_parse_seo_meta()` — robust parser handles section headers, colons, numbered lists, strips quotes. Falls back to truncated title/excerpt on parse failure.
- Pipeline flow changed from Outline(1)→Draft(2)→Review(3)→Image?(4) to **Outline(1)→Draft(2)→Review(3)→Meta(4)→Image?(5)**
- `total_steps` updated from `4/3` to `5/4`
- Both `ContentResult` and `GenerationResult` dataclasses carry new fields
- `generate_post()` passes through meta fields

**3. API + Scheduler**
- SSE `complete` event includes `meta_title`, `meta_description`, `image_alt_text`
- Non-streaming `test_content` endpoint returns same fields in `TestContentResponse`
- Scheduler `BlogPost()` creation includes all 3 meta fields from `GenerationResult`
- Post schemas (`PostCreate`, `PostUpdate`, `PostResponse`) include all 3 fields — existing `PUT /posts/{id}` edit flow works automatically

**4. WordPress publishing** (`services/publishing.py`)
- `_wp_upload_featured_image()` now accepts `alt_text` param — PATCHes the media item after upload (non-fatal)
- `publish_to_wordpress()` uses `meta_description` as excerpt (overrides `post.excerpt` when available)
- Yoast + RankMath meta fields via shotgun approach (silently ignored if plugins not installed):
  - `_yoast_wpseo_title` + `rank_math_title` ← meta_title
  - `_yoast_wpseo_metadesc` + `rank_math_description` ← meta_description
- Alt text passed to image upload: `alt_text=post.image_alt_text`

**5. Frontend — Progress bar** (`PromptForm.jsx`)
- `BASE_PIPELINE_STAGES` now has 4 entries: Outline, Draft, Review, **SEO Meta**
- Image stage shows when `progress.total > 4` (was `> 3`)

**6. Frontend — Test panel SEO card** (`PromptForm.jsx`)
- New SEO Metadata card below excerpt with patina green left accent border
- **Meta Title**: blue text (#1a0dab, mimics Google SERP), char count chip (green ≤60, bronze 61-78, sienna >78), copy button
- **Meta Description**: secondary text, char count chip (green 140-160, bronze outside), copy button
- **Image Alt Text** (conditional): italic text, char count chip (green ≤125, bronze >125), copy button
- Featured image `alt` attribute uses generated alt text

**7. Frontend — PostDetail SEO card** (`PostDetail.jsx`)
- New SEO Metadata card (borderLeft: 3px green) between Excerpt and Content cards
- Same layout as test panel: meta title (blue), meta description, image alt text
- Each with char count chip + copy button using existing `enqueueSnackbar`
- `FeaturedImageCard` component accepts `altText` prop, uses it as `alt` attribute
- Added `Tooltip`, `IconButton`, `ContentCopy` imports

**Files created:**
- `backend/migrations/versions/i8j9k0l1m2n3_add_seo_meta_to_blog_posts.py`

**Files changed:**
- `backend/app/models/blog_post.py` — 3 new columns
- `backend/app/schemas/posts.py` — 3 fields on PostCreate, PostUpdate, PostResponse
- `backend/app/schemas/templates.py` — 3 fields on TestContentResponse
- `backend/app/services/content.py` — constants, SeoMetaResult, _generate_seo_meta(), _parse_seo_meta(), pipeline wiring, dataclass updates
- `backend/app/services/publishing.py` — alt_text on image upload, meta_description as excerpt, Yoast/RankMath meta fields
- `backend/app/services/scheduler.py` — 3 meta fields on BlogPost creation
- `backend/app/api/templates.py` — 3 meta fields on SSE complete event + non-streaming endpoint
- `frontend/src/pages/prompts/PromptForm.jsx` — meta stage in progress bar, SSE parsing, SEO metadata card, image alt text
- `frontend/src/pages/posts/PostDetail.jsx` — SEO metadata card, FeaturedImageCard altText prop, new imports

**Open bugs:** None identified this session.

---

### 2026-02-16 (Session 24) — Docker Setup, Trailing Slash Fix, Content Quality

**What we did:**
Containerized the full stack with Docker Compose (3 containers: postgres, backend, frontend/nginx), fixed a trailing-slash bug in WordPress API URLs, removed a redundant schedule toggle, and improved article openings to eliminate generic AI patterns.

**1. Docker Compose setup (6 new files)**
- `backend/Dockerfile` — Python 3.13-slim, system deps (gcc, libpq, postgresql-client)
- `backend/start.sh` — waits for postgres (`pg_isready`), runs `alembic upgrade head`, starts uvicorn
- `frontend/Dockerfile` — multi-stage: node:22-alpine build → nginx:alpine serve
- `frontend/nginx.conf` — static files, `/api/` proxy to backend, SPA fallback, gzip, SSE support (`proxy_buffering off`)
- `docker-compose.yml` — 3 services, health checks, persistent postgres volume, bridge network. Only port 80 exposed. Backend health check uses Python urllib (no curl in slim image). `env_file` optional.
- `.env.example` — documents required env vars for fresh clones
- `backend/.dockerignore` + `frontend/.dockerignore` — exclude .venv, node_modules, .env
- **Discovered missing dep**: added `email-validator==2.2.0` to `requirements.txt` (Pydantic `EmailStr` needs it; was transitively installed locally but not in fresh container)

**2. Trailing-slash bug fix (WordPress API URLs)**
- REST API URLs ending with `/` caused double slashes (e.g. `wp-json//wp/v2/users/me` → 404)
- Added `api_url.rstrip("/")` in `_test_wp_connection()`, `_fetch_categories()`, `_fetch_tags()` (sites.py) and `publish_to_wordpress()`, `_wp_upload_featured_image()` (publishing.py)

**3. Removed "Include AI-generated images" toggle from schedules**
- `ScheduleForm.jsx`: removed `<Switch>` + `FormControlLabel`, cleaned `include_images` from form state and edit loading. Image source is already configured per-template in the Defaults tab — the schedule toggle was redundant.

**4. Article opening quality improvement**
- Added `OPENING PARAGRAPH` rule to Writing Guardrails: explicitly bans hypothetical/rhetorical openers ("Imagine...", "Picture yourself...", "Have you ever...", "What if...") and instructs AI to lead with facts, bold claims, statistics, or direct answers instead
- Updated first contrastive example: BAD now shows "Imagine/Picture/What if" pattern (was generic transition spam), GOOD shows substance-first opening
- Added "Imagine", "Picture this", "Have you ever wondered" to `BANNED_CLICHES` (86 phrases total)

**5. SEO keyword instruction softened**
- Title prompt no longer says "incorporate near the front of titles" — was causing the AI to force the exact keyword phrase (e.g. "direct benefits") into every title regardless of headline style
- New instruction: "Incorporate this keyword's core concept naturally — do NOT force the exact phrase into every title. Adapt, abbreviate, or rephrase to fit the headline style."
- Task section changed from "place the primary keyword near the front" to "Prioritize click-worthy, natural-sounding headlines over keyword stuffing."

**6. Test panel uses unsaved form state for headline style**
- **Bug**: Changing the headline style dropdown (e.g. contrarian → how-to) in the template form and clicking "Test" still generated titles in the old style, because the test endpoint loaded the saved template from the DB
- **Fix**: `TestTopicRequest` schema now accepts optional `content_type` override. Frontend sends current `form.content_type` with the test request. Backend applies the override before generating titles. No save required to test style changes.

**Files changed (8 modified, 8 new):**
- `backend/Dockerfile` (new)
- `backend/start.sh` (new)
- `frontend/Dockerfile` (new)
- `frontend/nginx.conf` (new)
- `docker-compose.yml` (new)
- `.env.example` (new)
- `backend/.dockerignore` (new)
- `frontend/.dockerignore` (new)
- `backend/requirements.txt` — added `email-validator==2.2.0`
- `backend/app/api/sites.py` — trailing-slash fix in 3 functions
- `backend/app/services/publishing.py` — trailing-slash fix in 2 functions
- `backend/app/services/content.py` — opening paragraph guardrail, updated contrastive example, 3 new banned phrases, softened keyword instruction
- `backend/app/schemas/templates.py` — `TestTopicRequest` now accepts optional `content_type`
- `backend/app/api/templates.py` — test endpoint applies `content_type` override from request
- `frontend/src/pages/prompts/PromptForm.jsx` — sends `form.content_type` with test request
- `frontend/src/pages/schedules/ScheduleForm.jsx` — removed include_images toggle + unused imports

**Open bugs:** None identified this session.

---

### 2026-02-15 (Session 23) — Remove Draft from Schedules + User Guide Overhaul

**What we did:**
Simplified the schedule post status options by removing "Draft" (which had no clear workflow) and updated the User Guide to reflect all features built since it was originally written.

**1. Remove "Draft" from schedule post status**
- **Backend** (`schemas/schedules.py`): Changed `ScheduleCreate.post_status` default from `DRAFT` to `PENDING_REVIEW`
- **Frontend** (`ScheduleForm.jsx`): Removed "Draft" `<MenuItem>` from dropdown. Now only "Review First" (default) and "Auto-Publish". Existing schedules with `post_status: "draft"` display as "Review First" when editing.
- **Rationale**: "Draft" was a dead zone — the scheduler would generate content that silently sat in the posts list with no notification or review workflow. Every scheduled post should either go live or land in the Review Queue.

**2. User Guide overhaul** (`pages/guide/UserGuide.jsx`)
- **New section: "Posts & Review"** — covers Review Queue, Revise with AI, Content Calendar, and Skip Scheduled Runs. Added to TOC with `Article` icon.
- **Templates > Prompts**: Removed dead fields `topic_generation_prompt` and `content_generation_prompt` (unused since Session 11). Renamed `system_prompt` → `custom_instructions` with accurate description. Updated `experience_notes` to mention the Experience Interview button.
- **Templates > Defaults**: Removed `special_requirements` (removed from UI in Session 12). Added `image_source` and `image_style_guidance` (featured images from Session 18).
- **Schedules > Overrides**: Updated `post_status` to "Review First" / "Auto-Publish". Removed `include_images` (replaced by template-level image source) and `prompt_replacements` (unused).
- **Pipeline steps**: Added step 6 "Featured Image" (DALL-E 3 / Unsplash). Updated header from "5-Stage" to "Content Pipeline".
- **Getting Started**: Updated step 4 from "Publish Posts" to "Review & Publish" mentioning the Review Queue.
- **Calendar chips**: Removed "gray = draft" from color legend.
- **New MUI icon imports**: `Gavel`, `CalendarMonth`, `AutoFixHigh`, `SkipNext`.

**Files changed (3 total, 0 new files, 0 migrations):**
- `backend/app/schemas/schedules.py` — default `post_status` changed to `PENDING_REVIEW`
- `frontend/src/pages/schedules/ScheduleForm.jsx` — removed Draft option, updated defaults and load logic
- `frontend/src/pages/guide/UserGuide.jsx` — new Posts & Review section, removed dead fields, updated descriptions

**Open bugs:** None identified this session.

---

### 2026-02-15 (Session 22) — Content Iteration: "Revise with AI" Feature

**What we did:**
Added an AI-powered revision loop so users can give natural-language feedback on draft or pending_review posts and have the AI revise the article while preserving everything that works. Also fixed a pre-existing bug in schedule creation (`ScheduleCreate` schema missing `is_active` field).

**1. Backend dependency: `markdownify==0.14.1`**
- Added to `requirements.txt` — converts HTML back to markdown for the AI revision pipeline (posts store HTML, AI needs markdown)

**2. Content service: revision pipeline** (`services/content.py`)
- `html_to_markdown(html)` — wraps `markdownify` with ATX headings, dash bullets, strips images
- `RevisionResult` dataclass — `content_markdown`, `content_html`, `excerpt`, `revision_prompt_used`
- `revise_content(content_html, feedback, system_prompt, template?, progress_callback?)` — 2-step pipeline:
  - **Step 1 (Revise):** Sends current article markdown + user feedback to GPT-4o. Temperature 0.4. Prompt: "Preserve everything that works — only change what the feedback asks for."
  - **Step 2 (Polish):** Lighter quality pass — anti-robot checks + voice preservation only (no structural rubric since article was already reviewed). Temperature 0.2. Skipped if template is deleted.
- `_generate_revision_polish()` — simplified version of `_generate_review()`: banned phrases, paragraph openings, sentence length variation, active voice, voice preservation per personality level
- New constants: `REVISION_TIMEOUT = 120`, `REVISION_MAX_TOKENS = 4500`

**3. Schema** (`schemas/posts.py`)
- `ReviseRequest(BaseModel)` — `feedback: str` (min_length=1, max_length=5000)

**4. SSE streaming endpoint** (`api/posts.py`)
- `POST /{post_id}/revise-stream` — same SSE pattern as template `content-stream`
- Validates post ownership + status (draft/pending_review only)
- Loads template for voice settings (graceful if deleted)
- System prompt fallback chain: stored on post → rebuilt from template → generic fallback
- Streams `progress`/`complete`/`error` events via `asyncio.Queue`
- Does NOT auto-save — returns revised content for frontend preview
- New imports: `asyncio`, `json`, `logging`, `StreamingResponse`, `PromptTemplate`, `ReviseRequest`

**5. PostDetail frontend** (`pages/posts/PostDetail.jsx`)
- **"Revise with AI" button** — bronze-styled (`#B08D57`), `AutoFixHigh` icon, two placements:
  - Review Decision Bar (between Edit First and Reject) for `pending_review` posts
  - Top action bar for `draft` posts
- **Revision Dialog** (MUI `Dialog`, `maxWidth="md"`, `fullWidth`) with 3 states:
  - **Feedback state:** textarea (4 rows), Cancel + Revise buttons
  - **Progress state:** `RevisionProgressBar` component (2-step: Revise → Polish), dialog locked (`disableEscapeKeyDown`)
  - **Preview state:** scrollable HTML preview, three buttons: Discard / Revise Again / Accept Revision
- `RevisionProgressBar` component — numbered circles, `LinearProgress` bar, italic status message. Adapts to 1 or 2 steps (1 when template deleted = no polish).
- `handleRevise` function — SSE parsing via existing `fetchSSE()` helper, same buffer/parsing pattern as PromptForm
- `acceptRevisionMutation` — saves revised `content` + `excerpt` via `PUT /posts/{id}`, invalidates queries, triggers "EDITED" chip

**6. Bugfix: schedule creation crash**
- `api/schedules.py` line 60 referenced `data.is_active` but `ScheduleCreate` schema has no `is_active` field (schedules always start inactive)
- Removed the dead `if data.is_active:` guard — experience validation already runs on activate

**Files changed (6 total, 0 new files, 0 migrations):**
- `backend/requirements.txt` — added `markdownify==0.14.1`
- `backend/app/services/content.py` — `html_to_markdown()`, `RevisionResult`, `revise_content()`, `_generate_revision_polish()`
- `backend/app/schemas/posts.py` — `ReviseRequest` schema
- `backend/app/api/posts.py` — `POST /{post_id}/revise-stream` SSE endpoint
- `frontend/src/pages/posts/PostDetail.jsx` — Revise button, dialog, SSE handling, progress bar, accept mutation
- `backend/app/api/schedules.py` — removed invalid `data.is_active` reference in `create_schedule`

**Open bugs:** None identified this session.

---

### 2026-02-15 (Session 21) — Skip/Cancel Individual Scheduled Runs from Calendar

**What we did:**
Added the ability to skip (and restore) individual scheduled runs directly from the Content Calendar. Users can now cancel a specific future run without deactivating the entire schedule. Skipped events remain visible on the calendar with a dimmed, strikethrough appearance so users can see what they cancelled and undo it.

**1. Database: migration `h7i8j9k0l1m2`**
- Added `skipped_dates` (JSON, nullable, default `[]`) to `blog_schedules`
- Stores a list of `"YYYY-MM-DD"` strings — date-level granularity is sufficient since schedules fire at most once per day

**2. Model** (`models/blog_schedule.py`)
- Added `skipped_dates: Mapped[list] = mapped_column(JSON, default=list)` after `tag_ids`

**3. Schemas** (`schemas/schedules.py`)
- New `SkipDateRequest` — `date: str` with `YYYY-MM-DD` pattern validation via `@field_validator`
- New `SkipDateResponse` — `schedule_id`, `skipped_dates`, `message`
- Added `is_skipped: bool = False` to `CalendarEvent`
- Added `skipped_dates: list[str] = []` to `ScheduleResponse`

**4. API endpoints** (`api/schedules.py`)
- `POST /{schedule_id}/skip` — validates date is in the future and not already skipped, appends to `skipped_dates` list. Reassigns list (new object) to trigger SQLAlchemy dirty detection.
- `DELETE /{schedule_id}/skip` — removes date from list (unskip/restore). Takes `SkipDateRequest` body.
- Both placed before `/{schedule_id}` routes to avoid FastAPI path conflicts.

**5. Calendar endpoint update** (`api/schedules.py` — `get_calendar()`)
- Loads `skipped_dates` set per schedule for fast lookup
- Sets `is_skipped=True` on matching `CalendarEvent`s
- Skipped events do NOT advance `future_offset` — keeps topic prediction correct (skipped topic becomes the next run's topic)

**6. Scheduler guard** (`services/scheduler.py` — `execute_schedule()`)
- After `is_active` check, gets today's date in the schedule's timezone (`ZoneInfo(schedule.timezone)`)
- If today is in `skipped_dates`: logs, updates `next_run`, returns early
- Does NOT record `ExecutionHistory` (so `success_count` / topic round-robin stays intact)
- Does NOT increment `retry_count`
- Prunes past dates from `skipped_dates` on every execution (cleanup)

**7. Calendar frontend** (`pages/calendar/ContentCalendar.jsx`)
- Skip/unskip mutations via `useMutation` + `useQueryClient` to invalidate calendar query
- **Popover**: sienna "Skip This Run" button (with `BlockOutlined` icon) on scheduled events; dashed "SKIPPED" chip + green "Restore" button (with `RestoreIcon`) on skipped events
- **Grid chips**: skipped events get dashed border, strikethrough text, reduced opacity (0.55)
- **Indicator dots**: separate dashed-border dot for skipped events vs solid green for active scheduled
- **Legend**: "Skipped" entry with dashed outline swatch, placed after "Scheduled"
- Date extraction: `event.date.substring(0, 10)` to avoid timezone shift issues

**8. Expired image graceful fallback** (`pages/posts/PostDetail.jsx`)
- DALL-E image URLs expire after ~1 hour, but the URL string persists in the DB — previously showed a broken image icon
- New `FeaturedImageCard` component: attempts to load image, on `onError` shows a bronze-accented info card with `ImageOutlined` icon
- Context-aware message:
  - Published posts: "The image is live on your published site. The preview link has expired here."
  - Draft/other: "The temporary preview link has expired. Generate a new post to get a fresh image."
- WordPress images are unaffected — `_wp_upload_featured_image()` downloads and re-uploads at publish time

**Files created:**
- `backend/migrations/versions/h7i8j9k0l1m2_add_skipped_dates_to_blog_schedules.py`

**Files changed:**
- `backend/app/models/blog_schedule.py` — added `skipped_dates` column
- `backend/app/schemas/schedules.py` — `SkipDateRequest`, `SkipDateResponse`, `is_skipped` on `CalendarEvent`, `skipped_dates` on `ScheduleResponse`
- `backend/app/api/schedules.py` — 2 new endpoints + calendar skipped event handling
- `backend/app/services/scheduler.py` — skip guard + past-date cleanup
- `frontend/src/pages/calendar/ContentCalendar.jsx` — skip/restore UI, skipped styling, legend
- `frontend/src/pages/posts/PostDetail.jsx` — `FeaturedImageCard` component with expired URL fallback

---

## Session Log

### 2026-02-14 (Session 20) — Content Calendar

**What we did:**
Added a new `/calendar` page showing a monthly grid with both future scheduled runs (predicted from cron triggers) and past posts — giving a full content timeline at a glance. No database migration needed.

**1. Backend schemas** (`schemas/schedules.py`)
- `CalendarEvent` — unified event model with `event_type` ("scheduled"/"post"), schedule/site/template info, plus conditional fields (post: `post_id`, `title`, `status`; scheduled: `predicted_topic`)
- `CalendarResponse` — `events` list + `start`/`end` dates

**2. Backend endpoint** (`api/schedules.py`)
- `GET /schedules/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD` — placed BEFORE `/{schedule_id}` routes
- Validates range (max 62 days), queries posts + active schedules
- Walks `build_trigger().get_next_fire_time()` to predict future runs (cap: 100 per schedule)
- Topic prediction via round-robin: `(success_count + future_offset) % len(topics)`
- Returns sorted unified event list

**3. Frontend page** (`pages/calendar/ContentCalendar.jsx`)
- Custom 6x7 CSS Grid calendar — no external library
- Patina green gradient month nav bar with mini stats (upcoming/posts count)
- Day cells with color-coded event chips: green=scheduled, bronze=published, bronze outline=pending review, gray=draft, sienna outline=rejected
- Up to 3 chips per cell with "+N more" overflow; indicator dots top-right
- Today: green circle on day number + green left accent bar
- Weekend subtle shading, outside-month dimming
- Click day → Popover with full event details (schedule name, site chip, time, topic/title, "View Post" link)
- Click post chip → navigates to `/posts/{id}`
- `countUp` entrance animation (staggered by row+col), `ELASTIC` hover, `float` on empty state
- Legend bar, laurel divider on empty state
- All elements contained in single bordered container matching nav bar width
- `minmax(0, 1fr)` grid columns for equal-width days

**4. Route + nav** (`App.jsx`, `MainLayout.jsx`)
- `/calendar` route between schedules and posts
- "Content Calendar" nav item with `CalendarMonth` icon between Schedules and Blog Posts

**Design notes:**
- User preferred normal English month names (not Latin)
- CSS Grid alignment fix: header + day cells in single grid container, `minmax(0, 1fr)` prevents content from pushing columns wider

---

### 2026-02-14 (Session 18) — Featured Image Generation (DALL-E 3 + Unsplash)

**What we did:**
Added automatic featured image generation to the content pipeline. Every blog post can now get a hero image — either AI-generated via DALL-E 3 or sourced from Unsplash stock photos — configured per template and fully integrated into the test panel, scheduler, and WordPress publishing.

**1. New service: `backend/app/services/images.py`**
- `generate_featured_image(source, title, industry, style_guidance)` — dispatcher
- `_generate_dalle_image()` — DALL-E 3, 1792x1024 landscape, standard quality ($0.04/image), "no text overlay" instruction, 60s timeout
- `_search_unsplash_image()` — title-first search with industry fallback, landscape orientation, download tracking per API guidelines, 15s timeout
- All errors logged and return `None` — article pipeline continues without image

**2. Database: migration `f5a6b7c8d9e0`**
- Added `image_source` (String(20), nullable) and `image_style_guidance` (Text, nullable) to `prompt_templates`
- `BlogPost.featured_image_url` column already existed — no migration needed on post side

**3. Content pipeline wiring** (`services/content.py`)
- `ContentResult` and `GenerationResult` dataclasses now include `featured_image_url`
- `generate_content()` gains `image_source`, `image_style_guidance`, `industry` params
- Dynamic `total_steps` (3 or 4) — progress callbacks report correct total
- Image generation runs as step 4 after review, only when image source is set
- `generate_post()` passes template image settings through to `generate_content()`

**4. WordPress image upload** (`services/publishing.py`)
- New `_wp_upload_featured_image(image_url, site, title)` — downloads image to memory, uploads via `POST /wp/v2/media`, returns media ID
- `publish_to_wordpress()` — if `post.featured_image_url` is set, uploads image first and includes `featured_media` in post payload
- Non-fatal: image upload failure doesn't block post publishing

**5. Template API** (`api/templates.py`)
- `duplicate_template()` copies `image_source` and `image_style_guidance`
- `test_content` and `test_content_stream` endpoints pass image params to pipeline
- SSE `complete` event now includes `featured_image_url`

**6. Scheduler** (`services/scheduler.py`)
- BlogPost creation includes `featured_image_url=gen.featured_image_url`

**7. Frontend — Template form** (`PromptForm.jsx`)
- Defaults tab: "Featured Image" section with Image Source dropdown (None / DALL-E 3 / Unsplash)
- DALL-E option shows optional "Image Style Guidance" textarea
- Adaptive `ContentProgressBar` — dynamically shows 3 or 4 stages based on `progress.total`
- Test panel captures `featured_image_url` from SSE complete event
- Article preview shows featured image above content with source label overlay

**8. Frontend — Post detail** (`PostDetail.jsx`)
- Shows featured image above content card if `post.featured_image_url` exists

**Config:**
- Added `UNSPLASH_ACCESS_KEY` to `Settings` class (`core/config.py`)

**What does NOT change:**
- `BlogPost` model — `featured_image_url` already existed
- Post schemas — already had `featured_image_url`
- Title generation, interview, outline, draft, review steps — unchanged
- Shopify/Wix publishing — still "Coming Soon"

---

### 2026-02-14 (Session 17) — Review Step Improvements (P6): Outline + Rubric + Voice Preservation

**What we did:**
Rewrote the review/polish step of the AI content pipeline to fix three gaps identified in Session 7 research: the reviewer now sees the original outline for structural compliance checking, uses a prioritized rubric instead of a flat checklist, and preserves (or removes) voice/personality based on the template's personality level.

**1. New helper: `_build_voice_preservation()`** (`services/content.py`)
- Generates voice-specific rubric items for Priority 3 of the review prompt
- Three tiers based on `personality_level`:
  - **Levels 1-3 (neutral):** Instructs reviewer to *remove* opinionated language; only checks contractions flag
  - **Levels 4-6 (clear position):** Protects clear positions from hedging; checks all voice flags (humor, anecdotes, rhetorical questions, contractions, brand voice)
  - **Levels 7-10 (opinionated):** Aggressive preservation with concrete before/after example of what NOT to weaken; protects confrontational phrasing, sarcasm, bold claims
- Returns `- [ ]` rubric items injected into the review prompt

**2. Rewritten `_generate_review()`** (`services/content.py`)
- New signature adds 7 parameters: `outline`, `personality_level`, `use_humor`, `use_anecdotes`, `use_rhetorical_questions`, `use_contractions`, `brand_voice_description`
- Review prompt now structured as a three-priority rubric:
  - **Priority 1 — Structural Compliance:** section order matches outline, answer-first H2 openings, word budgets within ~15%, data markers present, conclusion = actionable next step
  - **Priority 2 — Anti-Robot Quality:** zero banned phrases, no repeated paragraph openings, varied sentence length, active voice, conversational transitions
  - **Priority 3 — Polish & Voice:** specific intro hook, short paragraphs, GEO knowledge blocks, plus voice preservation items from `_build_voice_preservation()`
- Original outline included in `<outline>` XML block for structural reference
- Temperature, max tokens, and timeout unchanged (0.2, 4500, 120s)

**3. Updated call site in `generate_content()`** (`services/content.py`)
- Now passes `outline`, all voice fields from the template, and `personality_level` to `_generate_review()`
- `use_contractions` uses ternary (not `or`) because `False` is a valid meaningful value

**What does NOT change:**
- No schema, migration, or frontend changes
- `generate_post()`, SSE streaming, scheduler path — all unchanged
- `_call_openai()`, temperature schedule, `build_content_system_prompt()` — unchanged
- Title generation, interview system, outline step — unchanged

**Files changed:**
- `backend/app/services/content.py` — new `_build_voice_preservation()` helper, rewritten `_generate_review()`, updated call site in `generate_content()`

---

### 2026-02-14 (Session 16) — Feedback Page + Full Git Catch-Up

**What we did:**
Added a full-stack Feedback page allowing users to submit bug reports, feature requests, and general feedback from within the app. Also committed all accumulated work from Sessions 1-15 to git (was previously uncommitted) and cleaned up tracked secrets.

**1. Feedback — Backend**
- New `Feedback` model (`backend/app/models/feedback.py`) — UUID PK, user FK (CASCADE), category (bug/feature/general), message (Text), created_at
- New Pydantic schemas (`backend/app/schemas/feedback.py`) — `FeedbackCreate` (category default "general", message min_length=1) + `FeedbackResponse`
- New router (`backend/app/api/feedback.py`) — `POST /feedback/` (create, sets user_id from JWT) + `GET /feedback/` (list own, newest first)
- Registered model in `models/__init__.py` and `migrations/env.py`
- Registered router in `main.py`
- Alembic migration `5345737bf6d2` — creates `feedback` table

**2. Feedback — Frontend**
- New page `frontend/src/pages/feedback/Feedback.jsx`:
  - Standard page title with green underline bar
  - Form: category dropdown (Bug Report / Feature Request / General Feedback), message textarea, submit button with loading state
  - Submission list below with category-colored left borders, chips, and timestamps
  - Roman-themed empty state: "Your voice shapes the forum"
  - React Query mutation for submit + query for list, success snackbar on submit
- Added `RateReview` icon + "Feedback" nav item in sidebar after "About Acta AI"
- Added `/feedback` route in `App.jsx`

**3. Git housekeeping**
- Committed all accumulated work from Sessions 1-15 (152 files, was all uncommitted)
- Removed `backend/.env` from git tracking (contained secrets — was tracked since initial commit)
- Removed all `__pycache__/` files from git tracking
- `.gitignore` already had rules for both — they were just tracked before the gitignore existed

**Files created:**
- `backend/app/models/feedback.py`
- `backend/app/schemas/feedback.py`
- `backend/app/api/feedback.py`
- `backend/migrations/versions/5345737bf6d2_add_feedback_table.py`
- `frontend/src/pages/feedback/Feedback.jsx`

**Files edited:**
- `backend/app/models/__init__.py` — added Feedback import
- `backend/app/main.py` — registered feedback_router
- `backend/migrations/env.py` — added Feedback to model imports
- `frontend/src/components/layouts/MainLayout.jsx` — added RateReview icon + Feedback nav item
- `frontend/src/App.jsx` — added Feedback import + /feedback route

---

### 2026-02-14 (Session 15) — Contrastive Examples (P3), Article Preview Fix, Schedules Page Fix

**What we did:**
Added contrastive good-vs-bad paragraph examples to the AI system prompt (P3 from the content pipeline improvement roadmap), fixed the article preview rendering raw markdown instead of styled HTML, and fixed the schedules page being completely blank.

**1. Contrastive examples in system prompt (P3)** (`backend/app/services/content.py`)
- New `CONTRASTIVE_EXAMPLES` constant — 3 BAD/GOOD paragraph pairs:
  1. Generic AI cliché opening → answer-first with specific data
  2. Passive hedging with weasel words → active voice with concrete numbers
  3. Monotonous same-length sentences → varied burstiness with personality
- Injected as `## Writing Examples (Do NOT copy these — internalize the patterns)` section in `build_content_system_prompt()`
- Placed after Writing Guardrails, before Content Structure — near the end of the prompt per Session 7 research ("lost in the middle" effect: examples at start or end are most effective)
- Header tells AI to internalize patterns, not copy the exact sentences

**2. Article preview code fence bug** (`backend/app/services/content.py`)
- **Problem:** GPT sometimes wraps its markdown response in code fences (` ```markdown ... ``` `). The Python `markdown` library correctly treats fenced content as a code block, converting it to `<pre><code>` — so the preview showed raw `##` and `###` as plain monospace text instead of rendered headings
- New `_strip_code_fences(text)` helper — strips opening fence (with optional language tag) and closing fence
- Applied to both draft and review outputs in `generate_content()` before `markdown_to_html()`
- This also fixes HTML sent to WordPress publishing and the scheduler path

**3. Schedules page blank** (`frontend/src/pages/schedules/SchedulesList.jsx`)
- **Problem:** `useEffect` on line 46 referenced `triggerMutation.isPending` (including in the dependency array), but `triggerMutation` was declared on line 85 with `const`. JavaScript `const` variables are in the temporal dead zone before their declaration → `ReferenceError` → entire component crashed → blank page
- **Fix:** Moved the `useEffect` to after the `triggerMutation` declaration

**4. Expanded banned phrases (P4)** (`backend/app/services/content.py`)
- Grew from 26 → 83 banned phrases across 6 categories (was 3 categories)
- 3 new categories:
  - `BANNED_HEDGING` (10): "it appears that," "generally speaking," "some might say," "one could argue," "it is widely believed," etc.
  - `BANNED_JOURNEY_POWER` (15): "unlock," "unleash," "embark on a journey," "deep dive into," "the power of," "revolutionize," "cutting-edge," etc.
  - `BANNED_OVERUSED_ADJECTIVES` (11): "seamless," "groundbreaking," "ever-evolving," "pivotal," "myriad," "invaluable," etc.
- Expanded existing categories: Transitions 5→12, AI-isms 15→24, Cliches 6→11
- All categories merged into `BANNED_PHRASES` master list, then deduped with user's `phrases_to_avoid` at prompt build time

**5. User Guide + About page updated for new phrase count**
- User Guide: Added 3 new color-coded chip sections (Hedging purple, Journey/Power teal, Adjectives olive) alongside existing 3
- Updated count text from "26 banned words" to "80+ banned words"
- About page: StatBlock "26+" → "80+", battle card text updated to "80+ hardcoded banned phrases across 6 categories"

**Files changed:**
- `backend/app/services/content.py` — `CONTRASTIVE_EXAMPLES` constant, `_strip_code_fences()` helper, applied to draft/review outputs, injected examples into system prompt, expanded banned phrases 26→83 across 6 categories
- `frontend/src/pages/schedules/SchedulesList.jsx` — moved `useEffect` after `triggerMutation` declaration
- `frontend/src/pages/guide/UserGuide.jsx` — 3 new banned phrase categories with color-coded chips, updated count
- `frontend/src/pages/guide/AboutActaAI.jsx` — updated stat block and battle card to 80+

---

### 2026-02-13 (Session 14) — Directory Cleanup, Shopify/Wix Coming Soon, Scheduler Verified + Title Dedup

**What we did:**
Cleaned up the project directory, set Shopify + Wix to "Coming Soon" status, verified the APScheduler engine is fully functional, and added title deduplication to prevent the scheduler from generating duplicate blog posts.

**1. Directory cleanup**
- Created `archive/` folder and moved `acta-ai/` (old project) and `reference/` (old code snapshots) into it
- Updated `.gitignore`: replaced `reference/` with `archive/`
- Root directory now contains only active files: `backend/`, `frontend/`, `CHANGELOG.md`, `PRD.md`, `dev.sh`

**2. Shopify + Wix → Coming Soon** (`frontend/src/pages/sites/SiteForm.jsx`)
- Platform dropdown now shows "Shopify (Coming Soon)" and "Wix (Coming Soon)"
- When either is selected, credential fields + test connection + save are replaced with a "coming soon" box:
  - Bronze-bordered card with `RocketLaunch` icon
  - "{Platform} Integration Coming Soon" heading
  - Copy explaining users can generate articles via the test panel and copy/paste
  - "Go to Templates" button linking to `/prompts`
- WordPress path unchanged — full credential fields, test connection, save
- Simplified `handleTest` and `handleSubmit` to WordPress-only (no more Shopify/Wix branches)
- Added `COMING_SOON_PLATFORMS` constant for easy future toggling
- **SitesList**: Shopify/Wix sites show bronze "Coming Soon" chip instead of Active/Inactive
- **ScheduleForm**: Filtered Shopify/Wix sites out of site dropdown

**3. APScheduler engine — verified fully built**
- `scheduler.py` already had: AsyncIOScheduler, build_trigger, execute_schedule (full pipeline), _record_failure (auto-deactivate after 3 failures), add/remove_schedule_job, start/stop_scheduler, get_scheduler_status
- `main.py` lifespan hooks already call start_scheduler/stop_scheduler
- All API endpoints already wired: CRUD, activate/deactivate, manual trigger, execution history
- Frontend ScheduleForm + SchedulesList already complete with all fields, toggle, "Run Now", execution history
- **Tested live** — "Run Now" successfully generated a post end-to-end
- Removed "APScheduler scheduling engine" from Next Up (was incorrectly listed as TODO)

**4. Schedule "Content Calendar" rename** (`frontend/src/pages/schedules/ScheduleForm.jsx`)
- Renamed Topics section heading to "Content Calendar"
- Updated description to explain the template vs. schedule relationship: "Your template defines *how* the AI writes. These topics define *what* it writes about."

**5. Title deduplication for scheduled runs**

*Problem:* With a single topic, the scheduler could generate the same or very similar blog post titles repeatedly since it had no awareness of previous posts.

*Backend — Content Service* (`services/content.py`)
- `generate_titles()`: new optional `existing_titles: list[str]` parameter
  - When provided, appends "ALREADY PUBLISHED (do NOT reuse or closely rephrase these titles)" with the list to the user prompt
  - The AI sees what's been done and generates fresh titles
- `generate_post()`: new optional `existing_titles` parameter, passed through to `generate_titles()`

*Backend — Scheduler* (`services/scheduler.py`)
- Before generating content, queries the **last 20 post titles** for the schedule (`BlogPost.title WHERE schedule_id = X ORDER BY created_at DESC LIMIT 20`)
- Passes them to `generate_post(existing_titles=...)`
- Test panel path unaffected — `existing_titles` defaults to `None`

**6. Roman scribe loading sequence for "Run Now"** (`frontend/src/pages/schedules/SchedulesList.jsx`)
- Replaced static "Generating..." spinner in the trigger dialog with a thematic loading experience
- 10 cycling italic messages every 4s: "Summoning the scribe...", "Unfurling the papyrus...", "Mixing the ink...", "Consulting the muses...", "The quill touches parchment...", "Composing the opening proclamation...", "Weaving arguments with rhetorical precision...", "Cross-referencing the archives...", "Reviewing for the Senate's approval...", "Applying the imperial seal..."
- Shimmering bronze gradient bar underneath (same shimmer keyframe pattern as dashboard)
- Dialog locks during generation (can't close until complete)
- `SCRIBE_MESSAGES` constant + `useEffect` interval cycling with cleanup
- Confirmation prompt shown before generation starts; scribe sequence replaces it while pending

**Bugs resolved:**
- Title generation 5-identical-titles bug (Session 7) — confirmed fixed, removed from "Next up"

**Files changed:**
- `frontend/src/pages/sites/SiteForm.jsx` — coming soon state, simplified WP-only handlers
- `frontend/src/pages/sites/SitesList.jsx` — coming soon badge for Shopify/Wix sites
- `frontend/src/pages/schedules/ScheduleForm.jsx` — filter coming-soon platforms, "Content Calendar" rename
- `frontend/src/pages/schedules/SchedulesList.jsx` — Roman scribe loading sequence for trigger dialog
- `backend/app/services/content.py` — `existing_titles` param on `generate_titles()` and `generate_post()`
- `backend/app/services/scheduler.py` — query last 20 titles, pass to `generate_post()`
- `.gitignore` — `reference/` → `archive/`

---

### 2026-02-13 (Session 13) — Dashboard Stats Click Affordance

**What we did:**
Cleaned up the project directory and set Shopify + Wix integrations to "Coming Soon" status, directing users to the test panel for content generation + copy/paste in the meantime.

**1. Directory cleanup**
- Created `archive/` folder and moved `acta-ai/` (old project) and `reference/` (old code snapshots) into it
- Updated `.gitignore`: replaced `reference/` with `archive/`
- Root directory now contains only active files: `backend/`, `frontend/`, `CHANGELOG.md`, `PRD.md`, `dev.sh`

**2. Shopify + Wix → Coming Soon** (`frontend/src/pages/sites/SiteForm.jsx`)
- Platform dropdown now shows "Shopify (Coming Soon)" and "Wix (Coming Soon)"
- When either is selected, credential fields + test connection + save are replaced with a "coming soon" box:
  - Bronze-bordered card with `RocketLaunch` icon
  - "{Platform} Integration Coming Soon" heading
  - Copy explaining users can generate articles via the test panel and copy/paste
  - "Go to Templates" button linking to `/prompts`
- WordPress path unchanged — full credential fields, test connection, save
- Simplified `handleTest` and `handleSubmit` to WordPress-only (no more Shopify/Wix branches)
- Added `COMING_SOON_PLATFORMS` constant for easy future toggling

**3. Coming Soon badge on sites list** (`frontend/src/pages/sites/SitesList.jsx`)
- Existing Shopify/Wix sites show a bronze "Coming Soon" chip instead of Active/Inactive status

**4. Schedule form guard** (`frontend/src/pages/schedules/ScheduleForm.jsx`)
- Filtered Shopify/Wix sites out of the site dropdown so users can't create schedules targeting unavailable platforms

**Bugs resolved:**
- Title generation 5-identical-titles bug (Session 7) — confirmed fixed, removed from "Next up"

**Files changed:**
- `frontend/src/pages/sites/SiteForm.jsx` — coming soon state, simplified WP-only handlers
- `frontend/src/pages/sites/SitesList.jsx` — coming soon badge for Shopify/Wix sites
- `frontend/src/pages/schedules/ScheduleForm.jsx` — filter coming-soon platforms from site dropdown
- `.gitignore` — `reference/` → `archive/`

---

### 2026-02-13 (Session 13) — Dashboard Stats Click Affordance

**What we did:**
Made the stats strip numbers on the Dashboard more obviously clickable by adding hover cues.

**Changes to `StatNumber` component** (`frontend/src/pages/dashboard/Dashboard.jsx`)
- On hover, the bronze label gets an **underline** (bronze color, 3px offset via `textUnderlineOffset`)
- A small **arrow** (`→` / `ArrowForward` icon) fades in to the right of the label, sliding in from the left (`translateX(-4px)` → `translateX(0)`, `opacity: 0` → `1`)
- Label wrapped in a flex `Box` with the arrow to keep them aligned
- Both cues use `0.3s ease` transitions and disappear cleanly on mouse leave
- `ArrowForward` icon was already imported — no new dependencies

**Files changed:**
- `frontend/src/pages/dashboard/Dashboard.jsx` — `StatNumber` component updated

---

### 2026-02-13 (Session 12) — Three New Advanced Prompt Controls + Special Requirements Cleanup

**What we did:**
Added three new template fields — **Target Reader Persona**, **Call to Action**, and **Preferred Terms** — that fill genuine gaps in the content pipeline. Also removed the redundant **Special Requirements** field (it was functionally identical to Custom Instructions).

**Why these three fields:**
- The pipeline knew *what level* (beginner/expert) but not *who specifically* reads the content → **Target Reader**
- There was no way to guide the business goal of a post → **Call to Action**
- Users could tell the AI what NOT to say (Phrases to Avoid) but not what TO say → **Preferred Terms**

**Database Migration** (`e4f5a6b7c8d9`)
- Added `target_reader` (Text, nullable) to `prompt_templates`
- Added `call_to_action` (Text, nullable) to `prompt_templates`
- Added `preferred_terms` (JSON, nullable) to `prompt_templates`
- Down revision: `d3e4f5a6b7c8`

**Backend — Model** (`models/prompt_template.py`)
- Added 3 columns after `special_requirements`: `target_reader`, `call_to_action`, `preferred_terms`

**Backend — Schemas** (`schemas/templates.py`)
- Added all 3 fields to `TemplateCreate`, `TemplateUpdate`, `TemplateResponse`
- `preferred_terms` typed as `list[str] | None`

**Backend — API** (`api/templates.py`)
- Added 3 fields to `duplicate_template()` copy constructor so duplicates include them

**Backend — Content Pipeline** (`services/content.py`)
- `target_reader` → appended to Content Guidelines: `"Target reader: {value}"`
- `call_to_action` → appended to Content Guidelines: `"Call to action: Naturally guide readers toward: {value}"`
- `preferred_terms` → appended to Writing Guardrails: `"ALWAYS use these preferred terms: {joined list}."`
- All three guarded by `if` checks — empty/null = skipped entirely
- **Removed** `special_requirements` from Content Guidelines (field was redundant with Custom Instructions)

**Frontend — PromptForm** (`pages/prompts/PromptForm.jsx`)
- **Target Reader Persona** → Basic Info tab, after Audience Level dropdown
  - TextField, multiline 2 rows
  - Tooltip explains it goes beyond audience level to describe the specific reader
- **Call to Action** → Prompts tab, Advanced Prompt Controls section, after Custom Instructions
  - TextField, multiline 2 rows
  - Tooltip explains the AI will naturally guide readers toward this action
- **Preferred Terms** → Voice & Tone tab, below Phrases to Avoid
  - ChipInput component (same pattern as Phrases to Avoid)
  - Tooltip explains it's the mirror image of Phrases to Avoid
- **Removed Special Requirements** from Defaults tab (was redundant with Custom Instructions)
- Added all 3 fields to form state, template load (useEffect), and submit handler (nullableStrings/nullableArrays)

**What does NOT change:**
- `special_requirements` DB column stays (no migration needed) — just not shown or used in pipeline anymore
- Title generation pipeline — unchanged
- Experience interview system — unchanged
- SSE progress, scheduler, test panel — unchanged

**Files changed:**
- `backend/migrations/versions/e4f5a6b7c8d9_add_advanced_prompt_controls.py` — NEW
- `backend/app/models/prompt_template.py` — 3 new columns
- `backend/app/schemas/templates.py` — 3 fields on all CRUD schemas
- `backend/app/api/templates.py` — 3 fields in duplicate_template()
- `backend/app/services/content.py` — inject into Content Guidelines + Writing Guardrails, remove special_requirements
- `frontend/src/pages/prompts/PromptForm.jsx` — 3 new UI fields, removed Special Requirements

---

### 2026-02-13 (Session 11) — Prompt Template Cleanup: Remove Freeform Prompts, Build from Structured Fields

**What we did:**
Removed three freeform prompt text boxes from the template form (AI Role, Title Generator, Article Generator) that were either conflicting with the auto-built system prompt or entirely dead code. The AI pipeline now builds all prompts from structured fields only, with an optional "Custom Instructions" escape hatch for advanced users.

**Problem 1 — AI Role box conflicts with hardcoded role:**
The UI told users "Tell the AI who it is," but `build_content_system_prompt()` **prepended** a hardcoded role ("You are a subject matter expert with 15+ years of hands-on experience in {industry}") and then concatenated the user's text. This caused:
1. Two competing "You are..." identities in the same prompt
2. Default text duplicated instructions already handled by structured fields (Voice & Tone tab, Content Structure, Writing Guardrails)
3. Users couldn't tell what they were actually controlling vs. what the system handled automatically

**Problem 2 — Title Generator was dead code:**
The `topic_generation_prompt` field was shown in the UI as editable, but `generate_titles()` **never referenced it**. It used its own hardcoded system prompt (`build_title_system_prompt()`) and a simple `f"Topic: {topic}"` as the user message. Users could rewrite this field and it would change nothing.

**Problem 3 — Article Generator duplicated system prompt:**
The `content_generation_prompt` default text ("Use markdown formatting with H2 sections," "End with a specific next step," "Open with a hook that demonstrates first-hand experience") duplicated instructions already in the Content Structure section, outline prompt, and E-E-A-T section. User edits could also contradict the auto-built system prompt (e.g., "write in passive voice" vs. guardrails saying "default to active voice").

**Change 1 — AI Role → Structured Role + Custom Instructions**

*Backend — Schema (`schemas/templates.py`)*
- `TemplateCreate.system_prompt`: changed from `Field(min_length=1)` (required) to `str = ""` (optional, defaults empty)
- No migration needed — DB column stays `Text NOT NULL`, empty string is valid

*Backend — Content Pipeline (`services/content.py`)*
- `build_content_system_prompt()` rewritten:
  - Role line now built entirely from structured fields: `industry`, `content_type`, `audience_level`
  - Example: "You are a subject matter expert with 15+ years of hands-on experience in technology, specializing in writing blog posts, for an intermediate audience."
  - If `template.system_prompt` is non-empty, it's appended as a `## Additional Instructions` section (not jammed into the role sentence)
- `generate_template_interview()` updated:
  - Was using `template.system_prompt[:200]` for author context
  - Now uses structured fields: industry, content_type, audience_level
  - Falls back to `system_prompt[:200]` as "Additional context" only if present

*Frontend — PromptForm (`pages/prompts/PromptForm.jsx`)*
- Removed "AI Role" TextField from the main Prompts tab area
- Updated info Alert to explain: "The AI's role is built automatically from your Industry, Content Type, and Audience Level on the Basic Info tab."
- Added "Custom Instructions" TextField inside the Advanced Prompt Controls collapse:
  - Tooltip: "Optional extra context for the AI that isn't covered by the structured fields..."
  - Maps to same `system_prompt` DB field — no migration needed
  - Placeholder: "Optional — add any additional instructions for the AI writer"
- Default `system_prompt` changed from the old "You are a professional blog writer..." text to empty string
- Existing templates with old AI Role text will show up as Custom Instructions (backward compatible)

**Change 2 — Remove Title Generator & Article Generator**

*Backend — Schema (`schemas/templates.py`)*
- `topic_generation_prompt`: changed from `Field(min_length=1)` to `str = ""` (optional)
- `content_generation_prompt`: changed from `Field(min_length=1)` to `str = ""` (optional)

*Backend — Content Pipeline (`services/content.py`)*
- `generate_content()`: draft prompt now hardcoded from structured fields (`effective_word_count`, `title`, `effective_tone`) instead of reading `template.content_generation_prompt` with placeholder substitution
- Removed `SafeDict` class and `substitute_placeholders()` function (no longer needed)
- `generate_titles()` was already ignoring `topic_generation_prompt` — no change needed (was dead code)
- `replacements` parameter left in function signatures to avoid cascading changes to API/scheduler callers — unused but harmless

*Frontend — PromptForm (`pages/prompts/PromptForm.jsx`)*
- Removed Title Generator and Article Generator TextFields from Advanced Prompt Controls
- Only Custom Instructions remains in the collapsible section
- Default values for both prompt fields changed to empty strings

**What does NOT change:**
- Title system prompt (`build_title_system_prompt()`) — has its own hardcoded role, never used any of these fields
- All auto-built system prompt sections (E-E-A-T, Content Guidelines, Voice & Style, SEO, Writing Guardrails, Content Structure, Reasoning Approach) — unchanged
- Experience interview, test panel, scheduler — all unchanged
- Database schema — no migration, DB columns stay, existing values ignored
- `replacements` / `prompt_replacements` on schedules and test schemas — still passed through but unused (separate cleanup if desired)

**Files changed:**
- `backend/app/schemas/templates.py` — all three prompt fields made optional (default `""`)
- `backend/app/services/content.py` — role built from structured fields, custom instructions as separate section, hardcoded draft prompt, removed `SafeDict`/`substitute_placeholders`
- `frontend/src/pages/prompts/PromptForm.jsx` — removed AI Role + Title Generator + Article Generator, added Custom Instructions in advanced controls

---

### 2026-02-13 (Session 10) — Dashboard Redesign

**What we did:**
Full visual redesign of the Dashboard page to match the rich visual language established by the About Acta AI page. Single file changed: `frontend/src/pages/dashboard/Dashboard.jsx`.

**Problem:** The old Dashboard felt clunky — heavy stat cards with inset shadows, boxy Paper containers with icon boxes and "View All" / "Add New" buttons, plain `<SectionHeader>` components, and a Quick Actions card with three identical outlined `<Button>` elements. The About page had gradient text, entrance animations, hover micro-interactions, and elegant section dividers — the Dashboard needed to match that standard.

**1. Hero Greeting** (replaces plain "Dashboard" header)
- Personalized: "Welcome back, {FirstName}" with gradient-text name
- Roboto Condensed uppercase font, 2rem
- Status subtitle: "{X} active schedules · {Y} posts published · Next run {time}"
- Shimmer accent bar above (bronze gradient, 3s infinite animation)
- Removed the old `<Divider>` below the header
- First name derived from email (pre-@ portion, capitalized)

**2. Stats Strip** (replaces 4 heavy Paper stat cards)
- Horizontal flex row with gradient-text numbers + bronze uppercase labels
- Thin gradient border lines top/bottom (`1px` height, bronze-stone gradient fading to transparent)
- Each stat clickable → navigates to its section (/sites, /prompts, /schedules, /posts)
- Staggered `countUp` entrance animations (0.1s–0.4s delay)
- Elastic `scale(1.08)` hover with gradient shift on the number
- Removed: icon boxes, "View All" buttons, "Add New" buttons, card borders, inset shadows

**3. Section Dividers** (replaces `SectionHeader`)
- Adopted About page's `SectionLabel` pattern: weight 900, uppercase, `0.06em` letter-spacing
- Gradient underline that fades to transparent (60% width, 3px, left-aligned)
- Section renamed from "Content Overview" / "Recent Content" → "Recent Activity"

**4. Recent Posts** (left column — upgraded)
- Staggered `countUp` entrance animation per list item (0.08s incremental delay)
- Hover: elastic `translateX(4px)` nudge + green left border reveal (3px, transparent → `#4A7C6F`)
- Better empty state: large `Article` icon with `float` animation (3s infinite), warmer copy
- Removed redundant "Create Schedule" button from card actions
- Added `ArrowForward` icon on "View All Posts" button

**5. Quick Actions** (sidebar — visual upgrade)
- Replaced 3 identical outlined buttons with `QuickAction` icon + label pairs
- Horizontal row layout with `space-around` justify
- Icon boxes: 48×48, green tint background → gradient fill + rotate(-8deg) scale(1.1) on hover
- Matches the `CapabilityCard` icon box pattern from the About page
- Staggered entrance animations (0.3s–0.46s)

**6. Sidebar Cards** (Pending Review, Needs Attention, Active Schedules)
- Pending Review + Needs Attention: added `countUp` entrance, elastic `translateY(-4px)` hover lift
- Pending Review number: gradient text (bronze tones) instead of plain `warning.main`
- Active Schedules: green pulse indicator dot (`pulseGlow` animation, 2s infinite) next to each name
- Schedule items now clickable → navigate to edit form
- Hover: `translateX(4px)` nudge with border reveal

**7. Animations** (imported from About page patterns)
- `countUp` — entrance fade-up for stats, list items, sidebar cards
- `shimmer` — hero accent bar (bronze gradient sweep)
- `pulseGlow` — active schedule indicator dots
- `float` — empty state icon bobbing
- `ELASTIC` constant: `cubic-bezier(0.34, 1.56, 0.64, 1)` for all interactive hover effects

**8. Grid API**
- Updated from deprecated `<Grid item xs={12}>` to new `<Grid size={{ xs: 12 }}>` for MUI v5+ consistency with About page

**What stays the same:**
- All data fetching (4 useQuery hooks, API calls)
- All navigation logic and route targets
- `STATUS_COLORS` / `STATUS_LABELS` constants
- `formatRelativeTime` helper
- Overall information architecture (hero → stats → posts + sidebar)
- Status chips, Auto badge, date display on post items

**Files changed:**
- `frontend/src/pages/dashboard/Dashboard.jsx` — full rewrite of the component

---

### 2026-02-13 (Session 9) — Template-Level Experience Interview Q&A

**What we did:**
Replaced the free-form "Experience Notes" textarea on the Prompts tab with a structured AI-generated interview Q&A system. Instead of staring at a blank textarea wondering what to write, users now click "Generate Interview" and get 5 targeted expertise questions based on their template's industry, role, and content type. Answers are saved as structured JSON and auto-formatted into plain-text `experience_notes` on save — so all downstream consumers (scheduler, schedule validation, generate_post, test panel) work unchanged.

**Problem:** The `experience_notes` textarea was too open-ended — users didn't know what to write. The test panel already had a great interactive interview (AI generates targeted questions, user answers), but that was ephemeral and title-specific. We needed that same guided approach at the template level so every article benefits.

**Database Migration** (`d3e4f5a6b7c8`)
- Added `experience_qa` JSON column to `prompt_templates` (nullable)
- Down revision: `b7c8d9e0f1a2`

**Backend — Model** (`models/prompt_template.py`)
- Added `experience_qa: Mapped[list | None] = mapped_column(JSON, nullable=True)` after `experience_notes`

**Backend — Schemas** (`schemas/templates.py`)
- New `ExperienceQAItem` model (`question: str`, `answer: str = ""`)
- New `ExperienceInterviewResponse` model (`questions: list[str]`)
- Added `experience_qa: list[ExperienceQAItem] | None` to `TemplateCreate`, `TemplateUpdate`, `TemplateResponse`

**Backend — Content Service** (`services/content.py`)
- New `generate_template_interview(template)` — generates 5 broad expertise questions via OpenAI
  - Distinct from existing `generate_interview()` which is title-specific (test panel)
  - Questions cover: credentials, case studies, misconceptions, failures, unique approaches
  - Uses template's industry, content_type, and system_prompt snippet for context
- New `format_experience_qa(qa_pairs)` — formats answered Q&A pairs into readable plain text
  - Only includes pairs with non-empty answers
  - Joins with double newlines

**Backend — API** (`api/templates.py`)
- New endpoint: `POST /{template_id}/generate-experience-questions` → returns `ExperienceInterviewResponse`
- `create_template`: auto-formats `experience_qa` → `experience_notes` on save
- `update_template`: auto-formats `experience_qa` → `experience_notes` on save
- `duplicate_template`: copies `experience_qa` field
- Added `ExperienceInterviewResponse` to schema imports

**Frontend — PromptForm** (`pages/prompts/PromptForm.jsx`)
- Replaced "Experience Notes" textarea on Prompts tab with interview Q&A UI:
  - "Generate Interview" / "Regenerate Questions" button (calls new endpoint)
  - 5 question cards with multiline answer textareas
  - Green border + light green background on cards when answer is non-empty
  - Empty state: dashed border box with `QuestionAnswer` icon and instructions
  - Legacy alert: shown when template has old-style `experience_notes` but no `experience_qa`
  - Disabled state: "Save first" alert on unsaved templates (needs template ID for API call)
- Added `experience_qa` to form state, template load, and save payload
- Added `experienceLoading` state, `handleGenerateExperienceQuestions`, `updateExperienceAnswer` handlers
- Empty `experience_qa` arrays converted to `null` before save
- Added `QuestionAnswer` MUI icon import

**What does NOT change:**
- Scheduler reads `experience_notes` (auto-populated from Q&A on save) — no change needed
- Schedule activation validates `experience_notes` — still works (Q&A answers populate it)
- `generate_post()` reads `experience_notes` — unchanged
- Test panel interactive interview (`generate_interview`) — still title-specific, independent system
- Per-topic experience on schedules — unchanged

**Files changed:**
- `backend/migrations/versions/d3e4f5a6b7c8_add_experience_qa_to_templates.py` — NEW
- `backend/app/models/prompt_template.py` — added `experience_qa` field
- `backend/app/schemas/templates.py` — `ExperienceQAItem`, `ExperienceInterviewResponse`, `experience_qa` on CRUD schemas
- `backend/app/services/content.py` — `generate_template_interview()`, `format_experience_qa()`
- `backend/app/api/templates.py` — new endpoint, auto-format on create/update, copy on duplicate
- `frontend/src/pages/prompts/PromptForm.jsx` — interview Q&A UI replacing textarea

---

### 2026-02-13 (Session 8) — SSE Progress Bar & Copy-to-Clipboard

**What we did:**
Replaced the static "Generating article..." spinner with a real-time Server-Sent Events progress bar that tracks each stage of the AI content pipeline. Also added a copy-to-clipboard button on the article preview.

**Problem:** Article generation runs 3 sequential OpenAI calls (outline, draft, review) taking 30-90 seconds. The old UI showed a `CircularProgress` spinner with static text — the user had no idea which stage was running or how far along the process was.

**SSE Progress Bar**

*Backend — Content Pipeline (`services/content.py`)*
- Added optional `progress_callback` parameter to `generate_content()` (async callable)
- Inserted 3 callback calls — one before each stage (outline, draft, review)
- Callback signature: `async callback(stage, step, total, message)`
- No behavior change when callback is `None` — scheduler path and existing `/test/content` endpoint unaffected

*Backend — Streaming Endpoint (`api/templates.py`)*
- New endpoint: `POST /templates/{id}/test/content-stream`
- Uses FastAPI `StreamingResponse` with `text/event-stream` media type
- Runs `generate_content()` inside `asyncio.create_task`, bridges progress via `asyncio.Queue`
- Streams 3 SSE event types:
  - `event: progress` — `{stage, step, total, message}` (sent before each pipeline stage)
  - `event: complete` — full result payload (same fields as `TestContentResponse`)
  - `event: error` — `{detail}` (on exception)
- Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no` (prevents nginx buffering)
- Existing `POST /test/content` endpoint untouched (backward compatibility)

*Frontend — SSE Helper (`services/api.js`)*
- Added `fetchSSE(path, body)` — uses native `fetch()` with JWT auth header
- Required because Axios cannot handle streaming responses
- Returns a `ReadableStream` reader for manual SSE parsing

*Frontend — Progress UI (`pages/prompts/PromptForm.jsx`)*
- New `ContentProgressBar` component with 3 stage indicators:
  - Numbered circles (pending), bold text (active), checkmark icon (done)
  - `LinearProgress` bar — determinate, patina green on stone `#E0DCD5` background, `borderRadius: 0`
  - Italic status message below the bar (e.g., "Building article outline...")
- Added `contentProgress` state (`{stage, step, total, message}`)
- Rewrote `handleTestContent` to use `fetchSSE` + `ReadableStream` SSE parsing with buffer management
- Progress bar appears in both paths: "Skip to Article" (bypasses interview) and "Step 3 — Generate Article"
- Replaced old `CircularProgress` spinners with `ContentProgressBar` component (extracted to avoid duplication)
- Reset `contentProgress` in `handleTestReset`
- Added `CheckCircleIcon` and `LinearProgress` MUI imports

**Copy Article to Clipboard**
- Added copy icon button (MUI `ContentCopy`) next to "Article Preview" header
- Copies the markdown version (more useful for pasting into other editors, CMS platforms, Google Docs, etc.)
- Shows success snackbar: "Article copied to clipboard"
- Tooltip: "Copy article as markdown"

**Files changed:**
- `backend/app/services/content.py` — `progress_callback` parameter on `generate_content()`
- `backend/app/api/templates.py` — new `/test/content-stream` SSE endpoint + `asyncio`/`json`/`StreamingResponse` imports
- `frontend/src/services/api.js` — `fetchSSE()` helper (named export)
- `frontend/src/pages/prompts/PromptForm.jsx` — `ContentProgressBar` component, SSE-based `handleTestContent`, copy button, new imports (`LinearProgress`, `CheckCircleIcon`, `ContentCopy`, `fetchSSE`)

---

### 2026-02-13 (Session 7) — User Guide, Content Pipeline Research & Improvements

**What we did:**

**1. User Guide Page (complete)**
- New `frontend/src/pages/guide/UserGuide.jsx` — comprehensive in-app documentation
- 5 accordion sections: Getting Started, Templates, Schedules, Sites, Content Quality & Ranking
- Table of Contents with click-to-expand-and-scroll navigation
- Documents all ~47 user-configurable fields with explanations
- Shows full banned phrases list (26 phrases in 3 color-coded categories as Chips)
- 5-stage pipeline visual breakdown, two-layer experience system explanation
- Personality level impact guide, tips for system prompts and experience notes
- Design-compliant: sharp corners, bronze top borders, no shadows, Montserrat uppercase headings
- Added `MenuBook` icon + "User Guide" nav item in sidebar (with divider separator)
- Added `/guide` route in App.jsx

**2. Content Pipeline Research (complete)**
- Researched 4 areas: contrastive examples in prompts, expanded banned phrases, outline engineering, word count/review/title rotation
- Established 6-priority improvement roadmap (see below)

**3. Priority 1 — Lower review temperature (complete)**
- Changed `_generate_review()` temperature from 0.5 → 0.2 in `content.py:543`
- Research showed 0.1-0.3 is optimal for editorial/polish passes

**4. Priority 2 — Enriched outline prompt (complete)**
- `OUTLINE_MAX_TOKENS` bumped from 1500 → 2500
- `_generate_outline()` now requests: per-section word budgets, answer-first statements (40-60 words per H2), key points, data markers, transition hooks
- Draft prompt updated to enforce section word budgets with "write at least {word_count} words" floor

**5. Enter key in Test Panel (complete)**
- Added `onKeyDown` handler to Topic/Idea TextField in PromptForm.jsx
- Enter now triggers "Generate Titles" instead of submitting the parent form

**6. About Acta AI page (complete)**
- New `frontend/src/pages/guide/AboutActaAI.jsx` — "About Acta AI" marketing/differentiator page
- Explains what makes Acta AI different from other AI content tools and why it's superior
- Hero section with animated shimmer bar, gradient text ("~~content~~ → authority"), strikethrough effect
- Stats bar: 5 AI Stages, 26+ Banned Phrases, 10 Voice Levels, 2 Experience Layers, 3 Platforms
- "The Problem" section with animated banned phrase wall (each word gets a staggered strikethrough animation, "BANNED" watermark rotated behind)
- 5-Stage Pipeline visualization with vertical connector lines, animated gradient left border, hover-reactive numbered steps
- 6 head-to-head "Battle Cards" (Acta AI vs Others): Content Pipeline, First-Hand Experience, Anti-Robot Detection, GEO Optimization, Voice Control, Full Transparency — each with animated gradient top border, hover lift, icon spin
- E-E-A-T breakdown: 4 cards with giant ghost background letters, hover-reveal animations, per-letter color coding
- 6 Key Capability cards with hover-fill icon boxes and sweep-in bottom gradient bars
- Closing statement with continuously animated gradient border frame
- All hover effects use springy cubic-bezier curves, 6 keyframe animations (shimmer, gradientBorder, pulseGlow, float, strikeAcross, countUp)
- No em dashes anywhere in user-facing text (intentional anti-AI style choice)
- Added `Info` icon + "About Acta AI" nav item in sidebar under User Guide
- Added `/about` route in App.jsx

**Open Bug: All 5 generated titles are identical**
- Title generation returns the same title 5 times (padded by fallback logic at content.py:451-452)
- Root cause not yet identified — likely a parsing issue in `_parse_numbered_titles()`
- The parser strips `1.` numbering and type labels (`HOW-TO:`, etc.) but the AI may be returning a format we haven't accounted for (e.g., markdown headers, nested formatting, or a single title instead of 5)
- Debug `print()` statements were added but the raw OpenAI response wasn't captured before session end
- **To diagnose next session**: Generate titles, then check backend stdout for `[TITLE DEBUG]` lines showing the raw response and parsed count. The `print()` statements are still in `content.py` lines 338 and 453.
- **Once raw response is visible**: Fix the parser regex or the `topic_generation_prompt` if the user's template override isn't asking for 5 titles
- Note: The `build_title_system_prompt()` correctly asks for 5 numbered titles, but the user's `topic_generation_prompt` is what gets sent as the user message — if the template's stored prompt is different from the default, it may conflict

**Content Pipeline Improvement Priorities (remaining)**

| Priority | Change | Status |
|----------|--------|--------|
| 1 | Lower review temp to 0.2 | DONE |
| 2 | Enrich outline prompt (answer-first + word budgets + transitions) | DONE |
| 3 | Add 2-3 contrastive examples to content system prompt (good vs bad paragraph pairs) | TODO |
| 4 | Expand banned phrases (~40-50 additions: hedging, journey metaphors, power phrases, overused adjectives) | TODO |
| 5 | Title rotation strategy (weighted random across 5 types instead of always index 0) | TODO |
| 6 | Pass outline to review step + rubric format + personality preservation when level >= 4 | TODO |

**Key research findings for future implementation:**
- Contrastive examples: 2-4 pairs max, show structural differences not just vocabulary, "lost in the middle" effect means place examples at start or end of prompt
- Banned phrases: hedging phrases are a major 2025-26 AI tell ("it appears," "generally speaking"), journey metaphors and "unlock/unleash" phrases are instant giveaways
- Outline: answer statements in the outline produce answer-first drafts naturally; per-section word budgets are the most effective technique for hitting word count targets
- Review: rubric format outperforms flat checklists; review pass should see original outline for structural compliance; high personality articles risk getting flattened by conservative review
- Title rotation: research suggests 35% listicle, 25% how-to, 20% experience, 15% direct benefit, 5% contrarian for optimal content calendar variety

**Files changed:**
- `frontend/src/pages/guide/UserGuide.jsx` — NEW
- `frontend/src/pages/guide/AboutActaAI.jsx` — NEW
- `frontend/src/components/layouts/MainLayout.jsx` — nav items (User Guide + About Acta AI) + divider + Info icon import
- `frontend/src/App.jsx` — routes + imports for UserGuide and AboutActaAI
- `frontend/src/pages/prompts/PromptForm.jsx` — Enter key handler on topic field
- `backend/app/services/content.py` — review temp, outline prompt, outline max tokens, draft prompt, title parser hardening + debug prints

---

### 2026-02-13 (Session 6) — Reverse Interview & Per-Topic Experience Injection

**What we did:**
Added a two-layer experience injection system to solve the "generic AI fluff" problem. The AI can no longer fabricate authority — it must use real human-provided experience data. Two paths: interactive interview (test panel) and persistent experience notes (template + per-topic on schedules).

**Problem:** AI-generated content passes as "content" but fails E-E-A-T because it fabricates generic "experience" — no real anecdotes, no specific numbers, no authentic voice. Google (and readers) can tell.

**Layer 1 — Template-Level Experience Notes**
- New `experience_notes` Text column on `prompt_templates` (migration `b7c8d9e0f1a2`)
- Persistent "brand bible" field — general credentials and authority that apply to every post
- Added to TemplateCreate/Update/Response schemas, form UI (Prompts tab), and template duplication
- **Required for scheduling** — activating a schedule with empty experience notes returns HTTP 400

**Layer 2 — Per-Topic Experience Notes (Schedule)**
- Schedule `topics` changed from `list[str]` to `list[TopicItem]` where `TopicItem = {topic: str, experience: str | None}`
- Each scheduled topic can have its own specific anecdote, data point, or opinion
- Scheduler combines template-level + per-topic experience into one context block
- Backward compatible — legacy string topics parsed gracefully

**Interactive Interview (Test Panel)**
- New `generate_interview(template, title)` function — generates 3-5 targeted questions via OpenAI
- System prompt: "You are an editorial researcher... extract specific, concrete, first-hand experience"
- Questions ask for: specific numbers, timeframes, failures, surprising findings, personal decisions
- New endpoint: `POST /templates/{id}/test/interview`
- Test panel flow: Titles → **Interview (Optional)** → Article
  - "Generate Questions" button after title selection
  - Each question renders as a card with multiline answer field
  - "Skip to Article" button always available (interview is optional)
  - Answered questions passed as `experience_answers` to content generation

**Content Pipeline Update**
- `build_content_system_prompt(template, experience_context)` — new optional param
- If experience context provided, injects "Author's First-Hand Experience" section BEFORE E-E-A-T signals
- Section instructs AI: "Weave these naturally... Do NOT paraphrase into generic advice — use the specific details provided"
- `generate_content()` and `generate_post()` accept `experience_context` parameter
- Pipeline is now: Titles (5 variants) → Interview → Outline → Draft → Review (up to 5 OpenAI calls)

**Schedule Activation Guard**
- `_validate_template_experience(db, template_id)` helper in `schedules.py`
- Called in `create_schedule` (when active), `update_schedule` (when becoming active), `activate_schedule`
- Clear error message: "Cannot activate schedule: template's Experience Notes field is empty..."

**Frontend — ScheduleForm Topics Redesign**
- Topics changed from flat chips to expandable cards
- Each topic card has: topic text, "EXP" badge (if experience note exists), expand/collapse arrow, delete button
- Expanded view shows "Your experience with this topic" textarea
- New topics auto-expand for immediate experience input
- Legacy string topics auto-normalized to object format on load

**Frontend — PromptForm Updates**
- New "Experience Notes" multiline field on Prompts tab (after AI Role)
- Interview Step 2 inserted between title selection and article generation
- Interview Q&A pairs shown in prompt audit section
- All interview state cleared on reset/new title generation

**Files changed:**
- `backend/app/models/prompt_template.py` — added `experience_notes` field
- `backend/app/schemas/templates.py` — InterviewRequest/Response, experience_answers on TestContentRequest, experience_notes on CRUD schemas
- `backend/app/schemas/schedules.py` — TopicItem model, topics uses list[TopicItem]
- `backend/app/services/content.py` — generate_interview(), experience_context param on build/generate/post functions
- `backend/app/services/scheduler.py` — structured topic parsing, combined experience context
- `backend/app/api/templates.py` — interview endpoint, experience context in test_content, DEFAULT_TEMPLATE update
- `backend/app/api/schedules.py` — _validate_template_experience guard
- `backend/migrations/versions/b7c8d9e0f1a2_...` — new migration
- `frontend/src/pages/prompts/PromptForm.jsx` — interview step UI, experience notes field
- `frontend/src/pages/schedules/ScheduleForm.jsx` — structured topics with experience cards

---

### 2026-02-13 (Session 5) — Anti-Robot & GEO Guardrails in System Prompt

**What we did:**
Hardcoded always-on writing quality guardrails into `build_system_prompt` so every AI generation benefits from anti-robot constraints, GEO-optimized structure, and reasoning priming — regardless of user template configuration. One file changed: `backend/app/services/content.py`.

**Problem:** AI output was reading like generic LLM text — predictable transitions ("Moreover..."), monotonous rhythm, neutral hedging, no structural optimization for answer engines.

**New Module-Level Constants**
- `BANNED_TRANSITIONS` — "Moreover,", "Furthermore,", "Additionally,", "In conclusion,", "It is worth noting"
- `BANNED_AI_ISMS` — "delve", "harness", "leverage", "crucial", "landscape", "tapestry", "multifaceted", "holistic", "paradigm", "synergy", "robust", "streamline", "utilize", "facilitate", "encompasses"
- `BANNED_CLICHES` — "In today's fast-paced world,", "In today's digital landscape,", "game-changing", "game-changer", "It is important to note", "at the end of the day"
- `BANNED_PHRASES` — combined master list of all three

**New Section: `## Writing Guardrails`** (always appended after SEO)
- NEVER-use list merging hardcoded `BANNED_PHRASES` with user's custom `phrases_to_avoid` (case-insensitive dedup so user entries don't repeat built-in ones)
- Conversational alternatives suggested: "Plus,", "On top of that,", "Here's the thing,", "The reality is"
- Burstiness instruction: vary sentence length, break symmetrical patterns, don't start consecutive paragraphs the same way
- Active voice mandate

**New Section: `## Content Structure`** (GEO optimization)
- Answer-first: direct 40-60 word summary after each H2 before diving into detail
- Modular passages: self-contained knowledge blocks that make sense independently
- Scannable hierarchy: H2 → H3, paragraphs 2-4 sentences max

**New Section: `## Reasoning Approach`** (chain-of-thought priming)
- Outline logical flow and key arguments before generating prose
- Identify and address likely counterarguments
- Each section builds on the previous, no repetition

**Enhanced: Voice & Style personality levels**
- Level 7-10: "Be opinionated and take strong stances. Avoid neutral hedging." (added anti-hedging)
- Level 4-6: "Take a clear position rather than hedging with 'some might say' or 'it depends.'" (NEW — previously no instruction for mid-range)
- Level 1-3: "Stay neutral and objective." (unchanged)

**Moved: `phrases_to_avoid`**
- Removed from Voice & Style section (where it was a simple list)
- Now handled in Writing Guardrails section (merged with hardcoded bans, deduped)

**Verification steps (not yet tested live):**
1. Start both servers
2. Edit a template → Test tab → generate title + article
3. Expand "View Prompts Sent" → confirm system prompt contains all three new sections
4. Read generated article for absence of banned phrases, varied rhythm, answer-first H2 summaries
5. Verify user-added "Phrases to Avoid" chips appear merged (not duplicated) in the guardrails

---

### 2026-02-12 (Session 4) — Shopify Publishing Integration + Branding

**What we did:**
Replaced the Shopify publishing stub with a real end-to-end integration: connection testing, blog selection, and article publishing. Also updated the app favicon and collapsed sidebar logo.

**Backend — Publishing Service** (`services/publishing.py`)
- Added `_shopify_auth_headers(site)` — builds `X-Shopify-Access-Token` header
- Replaced `publish_to_shopify` stub with full implementation:
  - Validates `default_blog_id` is set (raises `PublishError` if not)
  - POSTs article to `{api_url}/blogs/{blog_id}/articles.json`
  - Sends tags as comma-separated string (Shopify's format, not integer IDs)
  - Same error handling pattern as WordPress (ConnectError, TimeoutException, non-2xx)
  - Returns `PublishResult` with article ID and constructed public URL

**Backend — Sites API** (`api/sites.py`)
- Added `_test_shopify_connection(api_url, api_key)` — GETs `/shop.json` to verify credentials
- Added `_fetch_shopify_blogs(api_url, api_key)` — GETs `/blogs.json`, returns list of `{id, title}`
- Updated `test_connection` endpoint: Shopify now tests connection, fetches blogs, returns them in response with shop name
- Updated `refresh_site`: Shopify sites verify connection and update `last_health_check` (no categories/tags to sync)

**Backend — Schemas** (`schemas/sites.py`)
- Added `BlogOption` model (`id: str`, `title: str`)
- Extended `ConnectionTestResponse` with `blogs: list[BlogOption] | None = None`

**Frontend — SiteForm** (`pages/sites/SiteForm.jsx`)
- Added `default_blog_id` to form state (initial + edit load)
- After successful Shopify connection test, shows blog dropdown populated from `testResult.blogs`
- On edit, preserves current `default_blog_id` even without a fresh connection test
- `handleSubmit` strips `default_blog_id` for WordPress, includes it for Shopify/Wix

**Branding**
- Custom favicon: replaced default Vite icon with Acta AI "A" column logo (`favicon.png`)
- Updated `index.html` to reference `/favicon.png` (type `image/png`)
- Collapsed sidebar: replaced inline column SVG with the favicon image

---

### 2026-02-12 (Session 3) — Multi-Platform Site Abstraction

**What we did:**
Refactored the site model from WordPress-only to a generic multi-platform architecture supporting WordPress, Shopify, and Wix. This is the abstraction layer — actual Shopify/Wix publishing services are stubbed for Phase 4.

**Database Migration** (`a1b2c3d4e5f6`)
- Renamed table `wordpress_sites` → `sites`
- Added `platform` column (NOT NULL, backfilled as `"wordpress"`)
- Added `api_key` and `default_blog_id` columns for Shopify/Wix
- Made `username` and `app_password` nullable (only required for WordPress)
- Converted `wp_id` → `platform_id` (int→str) on categories and tags
- Converted `wordpress_id` → `platform_post_id` (int→str) on blog_posts
- Renamed `wordpress_url` → `published_url` on blog_posts (fixes "View Live" button bug)
- Dropped/recreated all FK constraints for the renamed table

**Backend Models**
- `WordPressSite` → `Site` with `platform`, `api_key`, `default_blog_id` fields
- Category/Tag: `wp_id` (Integer) → `platform_id` (String)
- BlogPost: `wordpress_id` → `platform_post_id`, `wordpress_url` → `published_url`
- Updated all FKs, relationships, and imports across 4 model files

**Backend Schemas**
- Added `Platform` StrEnum (`wordpress`, `shopify`, `wix`)
- `SiteCreate` with `@model_validator` enforcing platform-specific credentials
- `ConnectionTestRequest` now includes `platform` with optional credential fields
- `PostSiteInfo` and `ScheduleSiteInfo` now include `platform`

**Backend API**
- Test connection dispatches by platform: WP uses existing httpx logic, Shopify/Wix return "coming soon"
- Site creation only fetches WP categories/tags when `platform == "wordpress"`
- Refresh endpoint gated to WordPress only (400 error for others)
- Updated publish TODO comment for multi-platform dispatch

**Frontend**
- SiteForm: platform dropdown (disabled on edit), conditional credential fields per platform, platform-aware test connection
- SitesList: platform badge chip on each card, refresh button only for WordPress
- PromptForm: "WordPress categories/tags" → "Categories/Tags"
- ScheduleForm: site dropdown shows `Name (Platform)`

**Bug fix:** Frontend used `post.published_url` but backend returned `wordpress_url` — now aligned as `published_url` everywhere.

---

### 2026-02-12 (Session 2) — Foundation, Auth, CRUD, Frontend & Styling

**Phase 1: Foundation**
- Installed PostgreSQL 16 and Node 22 via Homebrew
- Scaffolded FastAPI backend with full project structure (app/core, app/api, app/models, app/schemas, app/services)
- Scaffolded React + Vite frontend with MUI, React Router, React Query, Axios, Notistack
- Created `dev.sh` script for starting both servers
- Set up Vite proxy so frontend `/api` calls forward to backend on port 8000

**Phase 2: Authentication**
- Created User model (UUID pk, email, hashed_password, full_name, is_active, timezone)
- Generated Alembic migration for users table
- Built auth API: register, login (OAuth2 form + JWT), refresh token, /me endpoint
- Created auth Pydantic schemas (UserCreate, UserResponse, TokenResponse, RefreshRequest)
- Used bcrypt directly (not passlib) to avoid Python 3.13 incompatibility
- Built frontend auth pages: Login, Register with error handling
- Created AuthContext with token interceptor and auto-refresh

**Phase 3: Core CRUD — Backend**
- Created 4 SQLAlchemy model files: WordPressSite (with Category/Tag children), PromptTemplate, BlogSchedule, BlogPost + ExecutionHistory
- Generated and ran Alembic migration for all 7 new tables
- Created Pydantic schemas for all entities (create/update/response patterns)
- Built 4 API routers:
  - Sites: full CRUD + test-connection + refresh categories/tags (httpx async)
  - Templates: full CRUD + duplicate + auto-create default template
  - Schedules: full CRUD + activate/deactivate + execution history
  - Posts: full CRUD + publish + reject with review notes
- Registered all routers in main.py
- Tested all APIs via curl — all working

**Phase 3: Core CRUD — Frontend Pages**
- **Sites**: SitesList (card grid, active/inactive chips, refresh, delete dialog) + SiteForm (add/edit, test connection)
- **Templates**: PromptsList (card grid, duplicate, delete) + PromptForm (3-section editor: basic info, prompts, defaults & advanced)
- **Schedules**: SchedulesList (card grid, active/paused toggle switch, frequency chips) + ScheduleForm (site/template selectors, frequency config, chip-based topic manager, options)
- **Posts**: PostsList (table with status filter, pagination, quick publish) + PostDetail (full content view, publish/reject actions, prompt audit trail) + PostEdit (title/content/excerpt editor)
- **Dashboard**: 4 stat cards (Sites, Templates, Active Schedules, Posts), recent posts list with status chips, pending review alert, quick actions sidebar, active schedules sidebar
- Updated App.jsx with all routes: /sites/new, /sites/:id/edit, /prompts/new, /prompts/:id/edit, /schedules/new, /schedules/:id/edit, /posts/:id, /posts/:id/edit

**Styling & Design Pass — "Roman Bronze Patina"**
- Complete theme overhaul inspired by ancient Roman bronze statues with patina oxidation
- Color palette:
  - Primary: patina verdigris green (#4A7C6F, #6B9E8A, #2D5E4A)
  - Warning: bronze/amber (#B08D57, #D4A574)
  - Error: sienna (#A0522D) — earthy, not neon
  - Background: warm stone/parchment (#FAF8F5)
  - Borders: warm gray (#E0DCD5)
- Typography: Montserrat font, heavy weights (700-900), uppercase headings with letter-spacing
- Design language: sharp square corners (borderRadius: 0) like carved stone, 1px borders instead of shadows, 2px thick outlined buttons
- Sidebar: 80px toolbar, "ACTA AI" weight-900 uppercase, patina green right-border on active nav
- Page headers: large uppercase titles with patina green underline bar (::after pseudo-element)
- Section headers: uppercase with letter-spacing throughout all forms
- Dashboard: stat cards with green icon boxes, "CONTENT OVERVIEW" / "RECENT CONTENT" section headers, green underline on card titles
- Cards: hover transitions with elevated shadow + green border
- Empty states: patina green icons instead of gray
- Auth pages: Paper wrapper with border, bold "ACTA AI" branding

**E2E Test Results**
- Register, Login, Create Site, Create Template, Create Schedule, Create Post — all pass
- Schedule activate/deactivate toggle — works
- Post update and publish — works
- Frontend builds clean (11,800 modules, 0 errors)
- Both servers running: backend :8000, frontend :5173 with proxy

**Key technical decisions:**
- bcrypt directly (not passlib) for Python 3.13 compatibility
- Vite proxy for /api routes — no CORS issues in dev
- Trailing slashes on API URLs to avoid FastAPI 307 redirects
- Local dev (no Docker) — PostgreSQL + Node via Homebrew
- MUI theme overrides handle ~70% of styling; page-level edits for the rest

**Bugs fixed:**
- passlib + bcrypt incompatibility on Python 3.13
- Vite 8 requiring Node 20.19+ (upgraded to Node 22)
- FastAPI 307 redirect on missing trailing slashes
- Alembic `app` module not found (fixed with PYTHONPATH=.)

---

### 2026-02-12 (Session 1) — Project Review & Clean Rebuild Setup

**What we did:**
- Full codebase audit and architecture review
- Created comprehensive PRD (14 sections covering features, data models, API, architecture, security, infra, monitoring, roadmap)
- Archived entire existing codebase into `/reference` folder for style/logic reference
- Cleaned project root to a blank slate
- Set up `.gitignore` (excludes reference/, node_modules, .env, secrets, etc.)
- Created PRD.md and CHANGELOG.md at project root

**Key decisions:**
- Clean rebuild chosen over refactoring in place
- Old code preserved in `/reference` (git-ignored) for reference
- PRD represents the ideal product, prioritized P0/P1/P2
- Tech stack: FastAPI + React (Vite) + PostgreSQL + Docker (for deployment later)
