# Changelog

All notable changes to Acta AI will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Next up
- Shopify/Wix publishing (currently "Coming Soon")
- Content pipeline improvements (priorities 5-6 from Session 7 research)

---

## Session Log

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
