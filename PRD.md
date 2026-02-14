# Acta AI — Product Requirements Document

> *Inspired by the Acta Diurna, the ancient Roman daily gazette — the world's first public information system.*

**Version**: 1.0
**Last Updated**: 2026-02-12
**Status**: Draft

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Product Goals & Success Metrics](#4-product-goals--success-metrics)
5. [Core User Flows](#5-core-user-flows)
6. [Feature Requirements](#6-feature-requirements)
7. [Data Models](#7-data-models)
8. [API Design](#8-api-design)
9. [System Architecture](#9-system-architecture)
10. [Security Requirements](#10-security-requirements)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Monitoring & Observability](#12-monitoring--observability)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Future Roadmap](#14-future-roadmap)

---

## 1. Product Overview

### 1.1 What is Acta AI?

Acta AI is a SaaS platform that automates blog content creation and publishing for WordPress sites using AI. Users connect their WordPress sites, craft prompt templates that define their brand voice, set up automated schedules, and let the system generate and publish high-quality blog posts on their behalf.

### 1.2 Value Proposition

- **For content marketers**: Maintain a consistent publishing cadence without the time investment of writing every post manually.
- **For agencies**: Manage content across multiple client WordPress sites from a single dashboard.
- **For small businesses**: Get a professional blog presence without hiring a content team.

### 1.3 Core Capabilities

| Capability | Description |
|---|---|
| Multi-site management | Connect and manage unlimited WordPress sites |
| AI content generation | Generate blog posts using configurable AI prompts |
| Flexible scheduling | Automate publishing on daily, weekly, monthly, or custom schedules |
| Editorial workflow | Review, edit, approve, or reject AI-generated content before it goes live |
| Template system | Create reusable prompt templates with custom variables and placeholders |
| Execution tracking | Full audit trail of every generation attempt, success or failure |

---

## 2. Problem Statement

Maintaining a consistent blog publishing schedule is one of the biggest challenges for WordPress site owners. Content creation is time-consuming, expensive, and hard to scale. Most businesses know they need to publish regularly for SEO and audience engagement, but fall behind because:

- Writing quality blog posts takes 2-4 hours each
- Hiring writers is expensive and requires editorial management
- Existing AI writing tools still require manual copy-paste workflows
- There is no end-to-end solution that generates *and* publishes directly to WordPress on a schedule

Acta AI eliminates the manual loop entirely: define your content strategy once, and the system executes it continuously.

---

## 3. Target Users

### 3.1 Primary Personas

**Solo Content Marketer**
- Manages 1-3 WordPress sites
- Needs to publish 2-5 posts per week
- Wants to maintain brand voice consistency
- Values the review-before-publish workflow

**Digital Marketing Agency**
- Manages 10+ client WordPress sites
- Needs per-client prompt templates and schedules
- Requires execution history for client reporting
- Values multi-site management from a single account

**Small Business Owner**
- Has one WordPress site
- Wants to "set it and forget it"
- Publishes 1-2 posts per week for SEO
- Values simplicity over customization

### 3.2 User Roles

| Role | Permissions |
|---|---|
| Owner | Full access — sites, templates, schedules, posts, billing, team |
| Editor | Manage templates, schedules, posts. Cannot manage sites or billing |
| Viewer | Read-only access to posts and execution history |

> **v1 scope**: Single-user accounts (Owner only). Multi-user roles are a future addition.

---

## 4. Product Goals & Success Metrics

### 4.1 Goals

1. **Reliability**: Every scheduled post generates and publishes on time, every time.
2. **Quality**: Generated content is coherent, on-brand, and publication-ready with minimal editing.
3. **Control**: Users always have the option to review content before it reaches their site.
4. **Simplicity**: A new user can go from sign-up to their first published post in under 10 minutes.

### 4.2 Success Metrics

| Metric | Target |
|---|---|
| Schedule execution success rate | > 99% |
| Time from signup to first published post | < 10 minutes |
| Post generation latency (end-to-end) | < 90 seconds |
| System uptime | 99.9% |
| Content requiring no edits before publish | > 70% |

---

## 5. Core User Flows

### 5.1 Onboarding Flow

```
Register → Connect WordPress Site → Create Prompt Template → Create Schedule → First Post Generated
```

1. User registers with email and password.
2. User adds a WordPress site by providing the site URL, username, and application password.
3. System verifies the connection and fetches categories/tags.
4. User creates a prompt template (or uses the default).
5. User creates a schedule linking the site, template, frequency, and topic list.
6. System generates the first post (user can trigger manually or wait for schedule).

### 5.2 Content Generation Flow

```
Schedule Triggers → Pick Topic → Generate Title → Generate Content → Format for WordPress → Save as Draft/Publish
```

1. Scheduler fires at the configured time.
2. System selects a random topic from the schedule's topic list.
3. AI generates a blog post title from the topic idea using the template's topic generation prompt.
4. AI generates the full blog post content using the template's content generation prompt.
5. Content is converted from Markdown to WordPress-compatible HTML.
6. An SEO excerpt is auto-extracted.
7. Post is saved to the database.
8. If `post_status` is "publish" and `enable_review` is false, the post is immediately published to WordPress.
9. Otherwise, the post is saved as "pending_review" for the user to approve.

### 5.3 Editorial Review Flow

```
Post Generated → User Reviews → Edit (optional) → Approve/Reject → Publish to WordPress
```

1. User navigates to the Posts page.
2. Posts with status "pending_review" are highlighted.
3. User opens a post, reads the generated content.
4. User can edit the title, content, excerpt, categories, and tags.
5. User clicks "Publish" to push to WordPress, or "Reject" with notes.
6. Published posts display their live WordPress URL.

### 5.4 Template Testing Flow

```
Select Template → Enter Test Topic → Generate Preview Title → Generate Preview Content → Iterate
```

1. User opens a prompt template.
2. User enters a test topic/idea.
3. System generates a sample title and content using the template.
4. User reviews output quality and adjusts prompts.
5. Repeat until satisfied, then save template.

---

## 6. Feature Requirements

### 6.1 Authentication & Account Management

| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | User registration with email and password | P0 |
| AUTH-2 | Email validation (format and uniqueness) | P0 |
| AUTH-3 | Password requirements: minimum 8 characters | P0 |
| AUTH-4 | JWT-based authentication with short-lived access tokens (30 min) | P0 |
| AUTH-5 | Refresh token mechanism for seamless session extension | P0 |
| AUTH-6 | Secure password hashing with bcrypt | P0 |
| AUTH-7 | Password reset via email | P1 |
| AUTH-8 | Email verification on registration | P1 |
| AUTH-9 | OAuth login (Google, GitHub) | P2 |
| AUTH-10 | Account deletion with data cleanup | P1 |

### 6.2 WordPress Site Management

| ID | Requirement | Priority |
|---|---|---|
| SITE-1 | Add WordPress site with URL, username, and application password | P0 |
| SITE-2 | Test connection before saving (verify credentials against WP REST API) | P0 |
| SITE-3 | Fetch and cache categories from connected site | P0 |
| SITE-4 | Fetch and cache tags from connected site | P0 |
| SITE-5 | Refresh categories/tags on demand | P0 |
| SITE-6 | Edit site credentials | P0 |
| SITE-7 | Delete site (cascade to schedules and posts) | P0 |
| SITE-8 | Display connection health status per site | P1 |
| SITE-9 | Encrypt stored WordPress credentials at rest (AES-256) | P0 |
| SITE-10 | Support custom REST API base URLs (non-standard WordPress installations) | P1 |
| SITE-11 | Automatic periodic connection health checks | P2 |

### 6.3 Prompt Template System

| ID | Requirement | Priority |
|---|---|---|
| TPL-1 | Create prompt templates with name and description | P0 |
| TPL-2 | Configure three-stage prompt pipeline: system prompt, topic generation prompt, content generation prompt | P0 |
| TPL-3 | Set default word count and tone per template | P0 |
| TPL-4 | Define custom placeholders with default values (e.g., `{audience}`, `{industry}`) | P0 |
| TPL-5 | Define typed variables (text, number, select, multiselect, boolean) | P1 |
| TPL-6 | Advanced content settings: content type, writing style, industry, audience level | P0 |
| TPL-7 | Special requirements field for additional AI instructions | P0 |
| TPL-8 | Duplicate existing templates | P0 |
| TPL-9 | Test topic generation with a template before using in schedule | P0 |
| TPL-10 | Test content generation with a template before using in schedule | P0 |
| TPL-11 | Provide sensible default templates on first use | P0 |
| TPL-12 | Reset templates to defaults | P1 |
| TPL-13 | Template versioning — track changes over time | P2 |

### 6.4 Scheduling Engine

| ID | Requirement | Priority |
|---|---|---|
| SCHED-1 | Create schedules linking a site, prompt template, and frequency | P0 |
| SCHED-2 | Frequency options: daily, weekly (specific day), monthly (specific day) | P0 |
| SCHED-3 | Custom cron expressions for advanced scheduling | P1 |
| SCHED-4 | Configure time of day for execution | P0 |
| SCHED-5 | Provide a list of topic ideas per schedule (system picks randomly) | P0 |
| SCHED-6 | Override template defaults: word count, tone, categories, tags | P0 |
| SCHED-7 | Set post status on generation: draft or publish | P0 |
| SCHED-8 | Enable/disable editorial review requirement per schedule | P0 |
| SCHED-9 | Activate/deactivate schedules without deleting | P0 |
| SCHED-10 | Manual "Run Now" trigger for immediate execution | P0 |
| SCHED-11 | Display next scheduled run time | P0 |
| SCHED-12 | Persistent job store — scheduled jobs survive application restarts | P0 |
| SCHED-13 | Prevent duplicate schedules for the same day/site combination | P1 |
| SCHED-14 | Timezone-aware scheduling (user-configurable timezone) | P1 |
| SCHED-15 | Retry failed executions with exponential backoff (max 3 retries) | P0 |
| SCHED-16 | Pause all schedules globally (maintenance mode) | P2 |

### 6.5 AI Content Generation

| ID | Requirement | Priority |
|---|---|---|
| GEN-1 | Two-stage generation: title first, then full content | P0 |
| GEN-2 | System prompt enrichment from template advanced settings | P0 |
| GEN-3 | Placeholder/variable substitution in prompts before sending to AI | P0 |
| GEN-4 | Title cleanup: strip quotes, markdown artifacts, extra whitespace | P0 |
| GEN-5 | Markdown-to-HTML conversion for WordPress compatibility | P0 |
| GEN-6 | Auto-extract SEO excerpt (max 160 chars, sentence-boundary aware) | P0 |
| GEN-7 | Configurable AI model selection (GPT-4, GPT-4 Turbo, GPT-4o) | P1 |
| GEN-8 | Support for alternative AI providers (Anthropic Claude, Google Gemini) | P2 |
| GEN-9 | AI-generated featured images via DALL-E or similar | P2 |
| GEN-10 | Content safety filtering — reject inappropriate or off-topic output | P1 |
| GEN-11 | Configurable max tokens and temperature per template | P1 |
| GEN-12 | Store the exact prompts used for each generated post (audit trail) | P0 |
| GEN-13 | Graceful error handling: timeout, rate limit, API key, token limit | P0 |
| GEN-14 | Fallback behavior on generation failure: save error to execution history, do not publish broken content | P0 |

### 6.6 Blog Post Management

| ID | Requirement | Priority |
|---|---|---|
| POST-1 | List all generated posts with filtering by site, schedule, and status | P0 |
| POST-2 | View full post content with metadata | P0 |
| POST-3 | Edit post title, content, excerpt, categories, tags before publishing | P0 |
| POST-4 | Publish draft posts to WordPress from the UI | P0 |
| POST-5 | Update already-published posts on WordPress (sync edits) | P1 |
| POST-6 | Delete posts (remove from WordPress if published) | P0 |
| POST-7 | Post status workflow: draft → pending_review → published / rejected | P0 |
| POST-8 | Rejection notes field for editorial feedback | P1 |
| POST-9 | Preview post rendering before publishing | P1 |
| POST-10 | Bulk actions: publish, delete, export selected posts | P2 |
| POST-11 | Display the live WordPress URL for published posts | P0 |
| POST-12 | Manual post creation (write directly, bypass AI generation) | P1 |
| POST-13 | Search posts by title or content | P1 |

### 6.7 Execution History & Reporting

| ID | Requirement | Priority |
|---|---|---|
| HIST-1 | Log every schedule execution with timestamp, type (manual/scheduled), success/failure, and error details | P0 |
| HIST-2 | Link execution records to generated posts | P0 |
| HIST-3 | View execution history per schedule | P0 |
| HIST-4 | Dashboard summary: total posts, success rate, active schedules, connected sites | P0 |
| HIST-5 | Filter execution history by date range and status | P1 |
| HIST-6 | Automatic pruning of old execution records (configurable retention) | P2 |
| HIST-7 | Export execution history as CSV | P2 |

### 6.8 Dashboard

| ID | Requirement | Priority |
|---|---|---|
| DASH-1 | Overview cards: total sites, templates, active schedules, total posts | P0 |
| DASH-2 | Recent posts list (last 10) with status indicators | P0 |
| DASH-3 | Upcoming scheduled runs (next 7 days) | P1 |
| DASH-4 | Execution success/failure chart (last 30 days) | P2 |
| DASH-5 | Quick actions: create site, create schedule, run schedule | P1 |

### 6.9 Help & Documentation

| ID | Requirement | Priority |
|---|---|---|
| HELP-1 | In-app FAQ page covering common questions | P0 |
| HELP-2 | WordPress application password setup guide | P0 |
| HELP-3 | Prompt template writing tips and best practices | P1 |
| HELP-4 | Contextual help tooltips on complex form fields | P1 |
| HELP-5 | Changelog / updates page | P2 |

---

## 7. Data Models

### 7.1 Entity Relationship Overview

```
User (1) ──→ (N) WordPressSite
User (1) ──→ (N) PromptTemplate
User (1) ──→ (N) BlogSchedule
User (1) ──→ (N) BlogPost

WordPressSite (1) ──→ (N) Category
WordPressSite (1) ──→ (N) Tag
WordPressSite (1) ──→ (N) BlogSchedule
WordPressSite (1) ──→ (N) BlogPost

PromptTemplate (1) ──→ (N) BlogSchedule
PromptTemplate (1) ──→ (N) BlogPost

BlogSchedule (1) ──→ (N) BlogPost
BlogSchedule (1) ──→ (N) ExecutionHistory

BlogPost (1) ←──→ (0..1) ExecutionHistory
```

### 7.2 Model Definitions

#### User

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| email | String(255) | Unique, Not Null, Indexed | Login email |
| hashed_password | String(255) | Not Null | bcrypt hash |
| full_name | String(255) | Not Null | Display name |
| is_active | Boolean | Default: true | Account active flag |
| timezone | String(50) | Default: "UTC" | User's preferred timezone |
| created_at | Timestamp | Auto | Account creation time |
| updated_at | Timestamp | Auto | Last modification time |

#### WordPressSite

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → User | Owner |
| name | String(255) | Not Null | Display name for the site |
| url | String(500) | Not Null | Site URL (e.g., `https://myblog.com`) |
| api_url | String(500) | Not Null | REST API base (e.g., `https://myblog.com/wp-json`) |
| username | String(255) | Not Null, Encrypted | WordPress username |
| app_password | String(255) | Not Null, Encrypted | WordPress application password |
| is_active | Boolean | Default: true | Connection enabled |
| last_health_check | Timestamp | Nullable | Last successful connection test |
| created_at | Timestamp | Auto | |
| updated_at | Timestamp | Auto | |

#### Category / Tag

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Internal identifier |
| site_id | UUID | FK → WordPressSite | Parent site |
| wp_id | Integer | Not Null | WordPress taxonomy ID |
| name | String(255) | Not Null | Display name |

#### PromptTemplate

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → User | Owner |
| name | String(255) | Not Null | Template name |
| description | Text | Nullable | Purpose description |
| system_prompt | Text | Not Null | Base system instruction for the AI |
| topic_generation_prompt | Text | Not Null | Prompt for generating a title from a topic idea |
| content_generation_prompt | Text | Not Null | Prompt for generating full article from a title |
| default_word_count | Integer | Default: 1500 | Target word count |
| default_tone | String(50) | Default: "informative" | Writing tone |
| content_type | String(50) | Nullable | blog_post, article, tutorial, listicle, how_to, review |
| writing_style | String(50) | Nullable | standard, casual, formal, academic, conversational |
| industry | String(100) | Nullable | Target industry vertical |
| audience_level | String(50) | Nullable | beginner, intermediate, advanced, general |
| special_requirements | Text | Nullable | Freeform additional instructions |
| placeholders | JSON | Default: {} | Map of placeholder name → default value |
| variables | JSON | Default: [] | Array of typed variable definitions |
| is_default | Boolean | Default: false | System-provided template flag |
| created_at | Timestamp | Auto | |
| updated_at | Timestamp | Auto | |

#### BlogSchedule

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → User | Owner |
| site_id | UUID | FK → WordPressSite | Target site |
| prompt_template_id | UUID | FK → PromptTemplate | Content template |
| name | String(255) | Not Null | Schedule name |
| frequency | Enum | Not Null | daily, weekly, monthly, custom |
| custom_cron | String(100) | Nullable | Cron expression (when frequency = custom) |
| day_of_week | Integer | 0-6, Nullable | Monday=0 through Sunday=6 |
| day_of_month | Integer | 1-31, Nullable | Day of month |
| time_of_day | String(5) | Not Null | HH:MM format (24-hour) |
| timezone | String(50) | Default: user timezone | Schedule timezone |
| topics | JSON | Not Null | Array of topic idea strings |
| word_count | Integer | Nullable | Override template default |
| tone | String(50) | Nullable | Override template default |
| include_images | Boolean | Default: false | Generate featured images |
| category_ids | JSON | Default: [] | WordPress category IDs to assign |
| tag_ids | JSON | Default: [] | WordPress tag IDs to assign |
| prompt_replacements | JSON | Default: {} | Custom placeholder overrides |
| post_status | String(20) | Default: "draft" | draft or publish |
| enable_review | Boolean | Default: true | Require approval before publishing |
| is_active | Boolean | Default: true | Schedule enabled |
| last_run | Timestamp | Nullable | Last execution time |
| next_run | Timestamp | Nullable | Next scheduled execution |
| retry_count | Integer | Default: 0 | Current retry attempt |
| created_at | Timestamp | Auto | |
| updated_at | Timestamp | Auto | |

#### BlogPost

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → User | Owner |
| site_id | UUID | FK → WordPressSite | Target site |
| schedule_id | UUID | FK → BlogSchedule, Nullable | Source schedule (null if manual) |
| prompt_template_id | UUID | FK → PromptTemplate, Nullable | Template used |
| title | String(500) | Not Null | Post title |
| content | Text | Not Null | HTML content body |
| excerpt | String(500) | Nullable | SEO meta description |
| featured_image_url | String(1000) | Nullable | Featured image URL |
| categories | JSON | Default: [] | WordPress category IDs |
| tags | JSON | Default: [] | WordPress tag IDs |
| status | Enum | Not Null | draft, pending_review, published, rejected |
| review_notes | Text | Nullable | Rejection/review feedback |
| wordpress_id | Integer | Nullable | Post ID on WordPress |
| wordpress_url | String(1000) | Nullable | Live URL on WordPress |
| system_prompt_used | Text | Nullable | Exact system prompt sent to AI |
| topic_prompt_used | Text | Nullable | Exact topic prompt sent to AI |
| content_prompt_used | Text | Nullable | Exact content prompt sent to AI |
| created_at | Timestamp | Auto | Generation time |
| published_at | Timestamp | Nullable | WordPress publish time |

#### ExecutionHistory

| Field | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Unique identifier |
| schedule_id | UUID | FK → BlogSchedule | Source schedule |
| user_id | UUID | FK → User | Owner |
| post_id | UUID | FK → BlogPost, Nullable | Generated post (null if failed) |
| execution_type | Enum | Not Null | scheduled, manual |
| execution_time | Timestamp | Not Null | When execution started |
| duration_ms | Integer | Nullable | Execution duration in milliseconds |
| success | Boolean | Not Null | Pass/fail |
| error_message | Text | Nullable | Failure details |

---

## 8. API Design

### 8.1 API Conventions

- **Base URL**: `/api/v1`
- **Auth**: Bearer token in `Authorization` header
- **Format**: JSON request/response bodies
- **Errors**: Consistent error response shape: `{ "detail": "message" }`
- **Pagination**: `?limit=N&offset=N` on list endpoints
- **Filtering**: Query parameters on list endpoints

### 8.2 Endpoints

#### Authentication

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Create account | No |
| POST | `/auth/token` | Login, receive access + refresh tokens | No |
| POST | `/auth/refresh` | Exchange refresh token for new access token | No |
| GET | `/auth/me` | Get current user profile | Yes |
| PUT | `/auth/me` | Update profile (name, timezone) | Yes |
| POST | `/auth/password-reset` | Request password reset email | No |
| POST | `/auth/password-reset/confirm` | Set new password with reset token | No |

#### WordPress Sites

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/sites/test-connection` | Verify WordPress credentials | Yes |
| POST | `/sites` | Add a new WordPress site | Yes |
| GET | `/sites` | List all connected sites | Yes |
| GET | `/sites/{id}` | Get site details with categories & tags | Yes |
| PUT | `/sites/{id}` | Update site connection | Yes |
| DELETE | `/sites/{id}` | Remove site (cascades) | Yes |
| GET | `/sites/{id}/categories` | List site categories | Yes |
| GET | `/sites/{id}/tags` | List site tags | Yes |
| POST | `/sites/{id}/refresh` | Re-fetch categories & tags from WordPress | Yes |

#### Prompt Templates

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/templates` | Create template | Yes |
| GET | `/templates` | List all templates | Yes |
| GET | `/templates/{id}` | Get template details | Yes |
| PUT | `/templates/{id}` | Update template | Yes |
| DELETE | `/templates/{id}` | Delete template | Yes |
| POST | `/templates/{id}/duplicate` | Clone a template | Yes |
| POST | `/templates/test/topic` | Generate sample title | Yes |
| POST | `/templates/test/content` | Generate sample content | Yes |

#### Schedules

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/schedules` | Create schedule | Yes |
| GET | `/schedules` | List all schedules | Yes |
| GET | `/schedules/{id}` | Get schedule details | Yes |
| PUT | `/schedules/{id}` | Update schedule | Yes |
| DELETE | `/schedules/{id}` | Delete schedule (cascades) | Yes |
| PATCH | `/schedules/{id}/activate` | Enable schedule | Yes |
| PATCH | `/schedules/{id}/deactivate` | Disable schedule | Yes |
| POST | `/schedules/{id}/run-now` | Trigger immediate execution | Yes |
| GET | `/schedules/{id}/executions` | Get execution history | Yes |

#### Blog Posts

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/posts` | List posts (filterable by site, schedule, status) | Yes |
| POST | `/posts` | Create post manually | Yes |
| GET | `/posts/{id}` | Get post details | Yes |
| PUT | `/posts/{id}` | Update post content | Yes |
| DELETE | `/posts/{id}` | Delete post (and from WordPress if published) | Yes |
| POST | `/posts/{id}/publish` | Publish draft to WordPress | Yes |
| POST | `/posts/{id}/reject` | Reject post with notes | Yes |

#### System

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/health` | Health check (DB, scheduler status) | No |
| GET | `/metrics` | Prometheus metrics | No |

---

## 9. System Architecture

### 9.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Nginx                          │
│              (Reverse Proxy / SSL)                  │
└──────────┬────────────────────┬─────────────────────┘
           │                    │
    ┌──────▼──────┐     ┌──────▼──────┐
    │   React     │     │   FastAPI   │
    │  Frontend   │     │   Backend   │
    │  (Static)   │     │   (ASGI)    │
    └─────────────┘     └──┬───┬───┬──┘
                           │   │   │
              ┌────────────┘   │   └────────────┐
              │                │                │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼───────┐
       │ PostgreSQL  │ │   OpenAI    │ │  WordPress    │
       │  Database   │ │    API      │ │  REST APIs    │
       └─────────────┘ └─────────────┘ └───────────────┘
              │
       ┌──────▼──────┐
       │ APScheduler │
       │ (Persistent │
       │  Job Store) │
       └─────────────┘
```

### 9.2 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + Vite | Fast build tooling, modern React features |
| **UI Framework** | Material-UI v5 | Production-ready component library |
| **State Management** | React Query + Context | Server state caching + lightweight auth state |
| **Backend** | FastAPI (Python) | Async-first, auto-generated OpenAPI docs, type safety |
| **ORM** | SQLAlchemy 2.0 (async) | Mature, async-capable, excellent PostgreSQL support |
| **Database** | PostgreSQL 16 | Reliable, JSON support, full-text search |
| **Scheduler** | APScheduler with SQLAlchemy job store | Persistent jobs, async support, cron expressions |
| **AI** | OpenAI API (GPT-4) | Best-in-class text generation |
| **HTTP Client** | httpx (async) | Async HTTP for WordPress API calls |
| **Auth** | JWT (access + refresh tokens) | Stateless, scalable authentication |
| **Reverse Proxy** | Nginx | SSL termination, static file serving, load balancing |
| **Containerization** | Docker + Docker Compose | Reproducible environments, easy deployment |
| **CI/CD** | GitHub Actions | Integrated with repository, free for public repos |
| **Monitoring** | Prometheus + Grafana | Industry-standard metrics and dashboards |
| **Logging** | Structured JSON logs + Loki | Queryable, centralized log aggregation |

### 9.3 Content Generation Pipeline

```
1. Scheduler triggers job
       │
2. Pick random topic from schedule.topics
       │
3. Build system prompt
   ├── Base system_prompt from template
   ├── Inject content_type, writing_style, industry, audience_level
   └── Append special_requirements
       │
4. Generate title
   ├── Send system prompt + topic_generation_prompt (with {idea} replaced)
   ├── Model: GPT-4 Turbo
   ├── Timeout: 30s, Retries: 2
   └── Clean title: strip quotes, markdown, whitespace
       │
5. Generate content
   ├── Send system prompt + content_generation_prompt (with {topic}, {word_count}, {tone} replaced)
   ├── Model: GPT-4 Turbo
   ├── Timeout: 60s, max_tokens: 4000
   └── Returns Markdown content
       │
6. Post-process
   ├── Convert Markdown → HTML (with extras, nl2br)
   ├── Strip leading H1 (WordPress adds title separately)
   └── Extract excerpt (160 chars, sentence-boundary)
       │
7. Save to database
   ├── Create BlogPost record
   ├── Store prompts used (audit trail)
   └── Create ExecutionHistory record
       │
8. Publish decision
   ├── If post_status="publish" AND enable_review=false → Publish to WordPress
   └── Otherwise → Save as pending_review
```

---

## 10. Security Requirements

### 10.1 Authentication & Authorization

| ID | Requirement |
|---|---|
| SEC-1 | Passwords hashed with bcrypt (cost factor 12) |
| SEC-2 | Access tokens expire after 30 minutes |
| SEC-3 | Refresh tokens expire after 7 days, stored securely, rotated on use |
| SEC-4 | All API endpoints (except auth and health) require valid JWT |
| SEC-5 | Users can only access their own resources (tenant isolation) |
| SEC-6 | Rate limiting on auth endpoints: 5 attempts per minute per IP |

### 10.2 Data Protection

| ID | Requirement |
|---|---|
| SEC-7 | WordPress credentials encrypted at rest using AES-256 |
| SEC-8 | OpenAI API key stored as environment variable, never in database |
| SEC-9 | Database connections use SSL in production |
| SEC-10 | No sensitive data in application logs |
| SEC-11 | CORS restricted to known frontend origins in production |

### 10.3 Infrastructure Security

| ID | Requirement |
|---|---|
| SEC-12 | HTTPS enforced via Nginx with TLS 1.2+ |
| SEC-13 | Docker containers run as non-root user |
| SEC-14 | Database not exposed to public network |
| SEC-15 | Environment-specific secrets managed via environment variables |
| SEC-16 | Dependency vulnerability scanning in CI pipeline |

---

## 11. Infrastructure & Deployment

### 11.1 Container Architecture

```yaml
Services:
  nginx:        # Reverse proxy, SSL, static files
    ports: [80, 443]

  backend:      # FastAPI application server
    port: 8000
    replicas: 1 (scalable)
    healthcheck: GET /api/v1/health

  frontend:     # React static build served by Nginx
    port: 3000

  postgres:     # Primary database
    port: 5432
    volume: postgres_data (persistent)

  redis:        # Cache and job broker (future)
    port: 6379
```

### 11.2 Deployment Pipeline

```
Push to main → GitHub Actions CI
  ├── Lint (backend + frontend)
  ├── Run tests (pytest + jest)
  ├── Build Docker images
  ├── SSH to production server
  ├── Pull latest code
  ├── Run database migrations (Alembic)
  ├── Rebuild and restart containers
  └── Health check verification
```

### 11.3 Environment Configuration

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | JWT signing key (min 32 chars) | Yes |
| `OPENAI_API_KEY` | OpenAI API authentication | Yes |
| `CORS_ORIGINS` | Allowed frontend origins (JSON array) | Yes |
| `ENVIRONMENT` | `development` or `production` | Yes |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING`, `ERROR` | No (default: INFO) |
| `ENCRYPTION_KEY` | AES key for credential encryption | Yes |

---

## 12. Monitoring & Observability

### 12.1 Metrics (Prometheus)

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `schedule_executions_total` | Counter | Schedule runs by status (success/failure) |
| `content_generation_duration_seconds` | Histogram | AI generation latency |
| `wordpress_publish_total` | Counter | WordPress publish attempts by status |
| `active_schedules` | Gauge | Currently active schedules |

### 12.2 Logging

- **Format**: Structured JSON with request ID correlation
- **Fields**: timestamp, level, message, request_id, user_id, module
- **Aggregation**: Loki for centralized querying
- **Retention**: 30 days

### 12.3 Alerting

| Alert | Condition | Severity |
|---|---|---|
| High error rate | > 5% of requests return 5xx in 5 min | Critical |
| Schedule failures | > 3 consecutive failures for a schedule | Warning |
| API latency | p95 > 5s for 10 minutes | Warning |
| Database connection failures | Any connection error | Critical |
| Disk usage | > 85% on any volume | Warning |

### 12.4 Dashboards (Grafana)

- **Application Overview**: Request rate, error rate, latency percentiles
- **Content Generation**: Generation success rate, latency, token usage
- **Scheduler Health**: Active schedules, execution timeline, failure rate
- **Infrastructure**: CPU, memory, disk, container status

---

## 13. Non-Functional Requirements

### 13.1 Performance

| Requirement | Target |
|---|---|
| API response time (p95, non-generation endpoints) | < 200ms |
| Content generation end-to-end | < 90 seconds |
| Dashboard page load | < 2 seconds |
| Concurrent users supported | 100+ |
| Database query time (p95) | < 50ms |

### 13.2 Reliability

| Requirement | Target |
|---|---|
| System uptime | 99.9% |
| Scheduled job execution accuracy | > 99% (within 60s of target time) |
| Data durability | No data loss on single-node failure |
| Graceful degradation | App remains usable if OpenAI API is down (existing posts still accessible) |

### 13.3 Scalability

| Requirement | Notes |
|---|---|
| Horizontal backend scaling | Stateless API servers behind Nginx load balancer |
| Database scaling | Connection pooling, read replicas if needed |
| Scheduler scaling | Single scheduler instance with persistent job store (leader election for multi-node) |

### 13.4 Compatibility

| Requirement | Details |
|---|---|
| WordPress versions | 5.6+ (REST API v2) |
| Browser support | Chrome, Firefox, Safari, Edge (last 2 versions) |
| Mobile responsiveness | All pages usable on screens 375px+ |

---

## 14. Future Roadmap

### Phase 2 — Enhanced Content Intelligence

- **Multi-provider AI support**: Claude, Gemini, open-source models
- **AI-generated featured images**: DALL-E / Stable Diffusion integration
- **SEO optimization**: Keyword suggestions, readability scoring, meta tag generation
- **Content calendar view**: Visual timeline of scheduled and published posts
- **Topic research**: AI-assisted topic ideation based on industry trends

### Phase 3 — Multi-User & Teams

- **Team workspaces**: Invite collaborators with role-based permissions
- **Approval workflows**: Multi-step review chains (writer → editor → publisher)
- **Activity feed**: Team activity log with @mentions and notifications
- **White-label**: Custom branding for agency use

### Phase 4 — Analytics & Optimization

- **Post performance tracking**: Pull WordPress analytics (views, comments, shares)
- **A/B testing**: Generate multiple title/content variants, track which performs best
- **Content recommendations**: AI suggests improvements to underperforming posts
- **Automated reporting**: Weekly/monthly content performance reports via email

### Phase 5 — Platform Expansion

- **Additional CMS support**: Webflow, Ghost, Medium, Shopify blogs
- **Social media cross-posting**: Auto-share to Twitter/X, LinkedIn, Facebook
- **Email newsletter integration**: Mailchimp, ConvertKit auto-syndication
- **REST API for third-party integrations**: Public API with API key auth
- **Webhook support**: Notify external systems on post generation/publish events

---

*This document defines the ideal product vision for Acta AI. Implementation should be prioritized by the P0 → P1 → P2 labels in each feature table, with P0 representing the minimum viable product.*
