import { useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Card, CardContent, Grid, Chip, Alert, Stack, Paper, Divider,
  List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  RocketLaunch, Language, Description, Schedule, Article,
  Tune, RecordVoiceOver, Search, Settings, Science,
  Shield, Psychology, AutoAwesome, CheckCircleOutline,
  Warning as WarningIcon, TipsAndUpdates, FormatQuote,
  Gavel, CalendarMonth, AutoFixHigh, SkipNext,
} from '@mui/icons-material';

// ---------------------------------------------------------------------------
// Data constants
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'getting-started', label: 'Getting Started', icon: <RocketLaunch /> },
  { id: 'templates', label: 'Prompt Templates', icon: <Description /> },
  { id: 'schedules', label: 'Schedules', icon: <Schedule /> },
  { id: 'posts', label: 'Posts & Review', icon: <Article /> },
  { id: 'sites', label: 'Sites', icon: <Language /> },
  { id: 'quality', label: 'Content Quality & Ranking', icon: <AutoAwesome /> },
];

const BANNED_TRANSITIONS = [
  'Moreover,', 'Furthermore,', 'Additionally,', 'In conclusion,',
  'It is worth noting', 'Consequently,', 'In summary,',
  "It's important to note", 'It should be noted',
  'With that being said,', 'That said,', 'Having said that,',
];
const BANNED_AI_ISMS = [
  'delve', 'harness', 'leverage', 'crucial', 'landscape', 'tapestry',
  'multifaceted', 'holistic', 'paradigm', 'synergy', 'robust',
  'streamline', 'utilize', 'facilitate', 'encompasses',
  'navigate', 'elevate', 'foster', 'empower', 'optimize',
  'spearhead', 'bolster', 'underscores', 'underpins',
];
const BANNED_HEDGING = [
  'it appears that', 'it seems that', 'generally speaking',
  'it could be argued', 'some might say', 'one could argue',
  'it is widely believed', 'many experts agree',
  'it is generally accepted', 'arguably',
];
const BANNED_JOURNEY_POWER = [
  'unlock', 'unleash', 'unlock the power', 'unlock the potential',
  'embark on a journey', 'navigate the landscape',
  'dive deep', 'deep dive into', 'take a deep dive',
  'the power of', 'the art of', 'the secret to',
  'revolutionize', 'transformative', 'cutting-edge',
];
const BANNED_OVERUSED_ADJECTIVES = [
  'seamless', 'seamlessly', 'invaluable', 'groundbreaking',
  'ever-evolving', 'ever-changing', 'vibrant', 'intricate',
  'comprehensive', 'pivotal', 'myriad',
];
const BANNED_CLICHES = [
  "In today's fast-paced world,", "In today's digital landscape,",
  'game-changing', 'game-changer', 'It is important to note',
  'at the end of the day', 'when it comes to',
  'without further ado', 'in the realm of',
  'look no further', "whether you're a seasoned",
];

const PIPELINE_STEPS = [
  { num: 1, title: 'Title Generation', desc: '5 headline variants in the style you chose (or one of each type in AI-Selected mode). The scheduler picks using weighted random for variety.' },
  { num: 2, title: 'Experience Interview', desc: 'Optional. The AI asks 3-5 targeted questions about your first-hand experience to inject into the article.' },
  { num: 3, title: 'Outline', desc: 'A structured outline is generated from your chosen title, ensuring logical flow before any prose is written.' },
  { num: 4, title: 'Draft', desc: 'Full article generated with your voice settings, SEO targets, experience context, and all guardrails active.' },
  { num: 5, title: 'Review', desc: 'A second AI pass reviews the draft for quality, coherence, and compliance with your style rules.' },
  { num: 6, title: 'Featured Image', desc: 'Optional. A featured image is generated via DALL-E 3 or sourced from Unsplash, based on the template\'s image setting.' },
];

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

const sectionHeaderSx = {
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontSize: '0.95rem',
  mb: 1,
};

function FieldChip({ label }) {
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      sx={{
        fontWeight: 600,
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        borderColor: '#4A7C6F',
        color: '#4A7C6F',
        mr: 0.5,
        mb: 0.5,
      }}
    />
  );
}

function FieldRow({ name, children }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <FieldChip label={name} />
      <Typography variant="body2" component="span" sx={{ ml: 0.5 }}>
        {children}
      </Typography>
    </Box>
  );
}

function SubCard({ title, icon, children }) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          {icon}
          <Typography sx={sectionHeaderSx}>{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function Tip({ children }) {
  return (
    <Alert
      severity="info"
      variant="outlined"
      icon={<TipsAndUpdates sx={{ color: '#B08D57' }} />}
      sx={{
        mt: 2,
        borderColor: '#B08D57',
        '& .MuiAlert-message': { color: '#2A2A2A' },
      }}
    >
      {children}
    </Alert>
  );
}

function WorkflowStep({ number, title, description }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#4A7C6F',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.1rem',
            mb: 1.5,
          }}
        >
          {number}
        </Box>
        <Typography sx={{ ...sectionHeaderSx, mb: 0.5 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </CardContent>
    </Card>
  );
}

function BannedPhraseChips({ phrases, color }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
      {phrases.map((p) => (
        <Chip
          key={p}
          label={p}
          size="small"
          sx={{
            bgcolor: color,
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        />
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section: Getting Started
// ---------------------------------------------------------------------------

function GettingStartedSection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Acta AI is an AI-powered autoblogger that generates and publishes content to
        WordPress, Shopify, and Wix. The core workflow has four steps:
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <WorkflowStep
            number={1}
            title="Connect Sites"
            description="Add your WordPress, Shopify, or Wix sites with their API credentials."
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <WorkflowStep
            number={2}
            title="Create Templates"
            description="Define your AI's role, voice, SEO targets, and content style. Templates are reusable across schedules."
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <WorkflowStep
            number={3}
            title="Set Up Schedules"
            description="Pick a template and site, add topics with first-hand experience notes, and set timing."
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <WorkflowStep
            number={4}
            title="Review & Publish"
            description="Generated posts land in your Review Queue. Approve, edit, revise with AI, or reject before publishing."
          />
        </Grid>
      </Grid>
      <Tip>
        Start by connecting a site, then create a template and test it using the built-in
        Test Panel before setting up your first schedule.
      </Tip>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section: Templates
// ---------------------------------------------------------------------------

function TemplatesSection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Templates control everything about how your content is generated — from the AI's
        persona to SEO settings to banned phrases. They're organized into five tabs.
      </Typography>

      {/* Basic Info */}
      <SubCard title="Basic Info" icon={<Settings fontSize="small" color="primary" />}>
        <FieldRow name="name">
          A short name for this template (e.g. "Tech Blog — Beginner Tutorials").
        </FieldRow>
        <FieldRow name="description">
          Internal notes about what this template is for. Not sent to the AI.
        </FieldRow>
        <FieldRow name="industry">
          The subject area (e.g. "cybersecurity", "home renovation"). Helps the AI
          calibrate its expertise level and terminology.
        </FieldRow>
        <FieldRow name="headline_style">
          Controls how titles are generated. Options:
        </FieldRow>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>AI-Selected (default):</strong> Generates one of each type (How-To, Contrarian,
            Listicle, Experience, Direct Benefit). Scheduler picks using weighted random — Listicle 35%,
            How-To 25%, Experience 20%, Direct Benefit 15%, Contrarian 5%.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>How-To:</strong> All 5 titles are actionable, instructional headlines.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Listicle:</strong> All 5 titles use numbered lists with scannable value.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Experience:</strong> All 5 titles are first-person, story-driven.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Direct Benefit:</strong> All 5 titles lead with the reader's outcome.
          </Typography>
          <Typography variant="body2">
            <strong>Contrarian:</strong> All 5 titles challenge conventional wisdom.
          </Typography>
        </Box>
        <FieldRow name="audience_level">
          Reader sophistication. Options: Beginner, Intermediate, Advanced, General.
          Controls vocabulary complexity and how much context the AI provides.
        </FieldRow>
      </SubCard>

      {/* Prompts */}
      <SubCard title="Prompts" icon={<Psychology fontSize="small" color="primary" />}>
        <FieldRow name="custom_instructions">
          Optional freeform instructions appended to the AI's system prompt. Use this for
          anything specific to your brand that isn't covered by the structured fields.
          Example: "Always include a cost breakdown. Never recommend competitor products by name."
        </FieldRow>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          The AI's role is built automatically from your <strong>Industry</strong>,{' '}
          <strong>Headline Style</strong>, and <strong>Audience Level</strong> settings — you
          don't need to write "You are a..." yourself.
        </Typography>
        <FieldRow name="experience_notes">
          Your general authority and background for E-E-A-T. Required to activate schedules.
          Use the <strong>Experience Interview</strong> button to have the AI ask you targeted
          questions — your answers are automatically formatted into experience notes.
          You can also write them manually.
        </FieldRow>
        <Tip>
          You don't need to mention SEO, guardrails, or structure rules in your custom instructions — those
          are automatically injected by the pipeline. Focus on what makes your content unique.
        </Tip>
      </SubCard>

      {/* Voice & Tone */}
      <SubCard title="Voice & Tone" icon={<RecordVoiceOver fontSize="small" color="primary" />}>
        <FieldRow name="perspective">
          Writing point of view. Options: First Person (I/We), Second Person (You), Third Person (They).
        </FieldRow>
        <FieldRow name="default_tone">
          Overall tone. Options: Informative, Conversational, Professional, Friendly,
          Authoritative, Witty, Empathetic, Inspirational, Casual, Formal.
        </FieldRow>
        <FieldRow name="personality_level">
          Scale of 1-10 controlling how opinionated the writing is.
        </FieldRow>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2"><strong>1-3 (Factual):</strong> Neutral, objective, no stance taken.</Typography>
          <Typography variant="body2"><strong>4-6 (Balanced):</strong> Takes a clear position with supporting evidence.</Typography>
          <Typography variant="body2"><strong>7-10 (Opinionated):</strong> Strong stances, bold claims, assertive voice.</Typography>
        </Box>
        <FieldRow name="brand_voice_description">
          Free-text description of your brand voice. Example: "Confident but not arrogant.
          Uses dry humor. Avoids corporate jargon."
        </FieldRow>
        <FieldRow name="phrases_to_avoid">
          Custom banned phrases added to the built-in list. Entered as chips. Case-insensitive
          and automatically deduplicated.
        </FieldRow>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Toggle Switches</Typography>
        <FieldRow name="use_contractions">
          On by default. Turn off for more formal writing ("do not" instead of "don't").
        </FieldRow>
        <FieldRow name="use_anecdotes">
          Encourages the AI to include short stories and real-world scenarios.
        </FieldRow>
        <FieldRow name="use_rhetorical_questions">
          Adds engagement hooks like "But what if that's not the whole story?"
        </FieldRow>
        <FieldRow name="use_humor">
          Lets the AI inject light humor where appropriate.
        </FieldRow>
        <Tip>
          Higher personality levels (7-10) work best when paired with strong experience notes.
          Without real expertise to back up bold claims, the writing can feel hollow.
        </Tip>
      </SubCard>

      {/* SEO */}
      <SubCard title="SEO" icon={<Search fontSize="small" color="primary" />}>
        <FieldRow name="seo_focus_keyword">
          Primary keyword to target. Appears in the title, first paragraph, and throughout.
        </FieldRow>
        <FieldRow name="seo_keywords">
          Secondary keywords. Enter as chips. Use the "Suggest Keywords" button to get
          AI-powered suggestions based on your focus keyword and industry.
        </FieldRow>
        <FieldRow name="seo_keyword_density">
          How aggressively to place keywords. Options: Low (natural mentions), Medium
          (regular placement), High (frequent use). Medium is usually best.
        </FieldRow>
        <FieldRow name="seo_meta_description_style">
          How the excerpt/meta description is written. Options: Concise (straightforward
          summary), Question (hooks with a question), Benefit-Driven (focuses on reader
          value), Statistic (leads with data).
        </FieldRow>
        <FieldRow name="seo_internal_linking_instructions">
          Tell the AI where to link internally. Example: "Link to /pillar-page whenever
          mentioning 'home automation' and to /product-page for product references."
        </FieldRow>
      </SubCard>

      {/* Defaults */}
      <SubCard title="Defaults" icon={<Tune fontSize="small" color="primary" />}>
        <FieldRow name="default_word_count">
          Target word count. Default is 1500. Can be overridden per schedule.
        </FieldRow>
        <FieldRow name="default_categories">
          Categories to assign to generated posts. Enter as chips.
        </FieldRow>
        <FieldRow name="default_tags">
          Tags to assign to generated posts. Enter as chips.
        </FieldRow>
        <FieldRow name="image_source">
          Featured image for generated posts. Options: None (no image), DALL-E 3
          (AI-generated, $0.04/image), or Unsplash (free stock photos). Images are
          automatically uploaded to WordPress when publishing.
        </FieldRow>
        <FieldRow name="image_style_guidance">
          Only for DALL-E 3. Describe the visual style you want. Example: "Clean
          minimalist illustration with soft colors, no text overlays."
        </FieldRow>
      </SubCard>

      {/* Test Panel */}
      <SubCard title="Test Panel" icon={<Science fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Available after saving a template. Lets you test the full content pipeline interactively:
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Step 1 — Generate Titles:</strong> Enter a topic idea. The AI produces 5
            headline variants matching your Headline Style setting. In AI-Selected mode you get
            one of each type; with a specific style, all 5 match. Pick one or edit it.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Step 2 — Experience Interview (optional):</strong> The AI asks 3-5 targeted
            questions about your first-hand experience with the topic. Your answers are woven into
            the article for authentic E-E-A-T signals.
          </Typography>
          <Typography variant="body2">
            <strong>Step 3 — Generate Article:</strong> Full article generated using all your
            template settings. Includes an HTML preview and a Prompt Audit panel showing exactly
            what was sent to the AI.
          </Typography>
        </Box>
        <Tip>
          Use the Prompt Audit section to fine-tune your template. It shows the exact system prompt,
          outline, and generation prompts the AI received — invaluable for debugging tone or
          structure issues.
        </Tip>
      </SubCard>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section: Schedules
// ---------------------------------------------------------------------------

function SchedulesSection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Schedules automate content generation. Each schedule connects a template to a site
        and runs on a timer, producing articles from your topic queue.
      </Typography>

      <SubCard title="Basic Setup" icon={<Settings fontSize="small" color="primary" />}>
        <FieldRow name="name">A name for this schedule (e.g. "Weekly SEO Blog").</FieldRow>
        <FieldRow name="site_id">Which connected site to publish to.</FieldRow>
        <FieldRow name="prompt_template_id">
          Which template to use for generation. The template's experience_notes must be
          filled in or activation will fail.
        </FieldRow>
      </SubCard>

      <SubCard title="Timing" icon={<Schedule fontSize="small" color="primary" />}>
        <FieldRow name="frequency">
          How often to generate. Options: Daily, Weekly, Monthly, Custom.
        </FieldRow>
        <FieldRow name="custom_cron">
          Custom cron expression for advanced scheduling (only when frequency is "Custom").
          Example: "0 9 * * 1,3,5" for 9 AM on Mon/Wed/Fri.
        </FieldRow>
        <FieldRow name="day_of_week">For weekly schedules — which day (0=Monday through 6=Sunday).</FieldRow>
        <FieldRow name="day_of_month">For monthly schedules — which day of the month.</FieldRow>
        <FieldRow name="time_of_day">What time to run, in HH:MM format (24-hour).</FieldRow>
        <FieldRow name="timezone">Timezone for the schedule. Default: UTC.</FieldRow>
      </SubCard>

      <SubCard title="Topics & Experience" icon={<Article fontSize="small" color="primary" />}>
        <FieldRow name="topics">
          Your topic queue. Each topic has a title and an optional experience field for
          topic-specific first-hand knowledge.
        </FieldRow>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>Two-layer experience system:</strong>
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Layer 1 — Template experience_notes:</strong> General authority and credentials.
            Applied to every article from this template.
          </Typography>
          <Typography variant="body2">
            <strong>Layer 2 — Per-topic experience:</strong> Specific anecdotes, case studies, or
            data points relevant to that one topic. Combined with the template layer at generation time.
          </Typography>
        </Box>
        <Tip>
          The more specific your per-topic experience, the better. Instead of "I know about this",
          write "In 2023, I migrated 50 client sites from Apache to Nginx, reducing average
          TTFB by 40%."
        </Tip>
      </SubCard>

      <SubCard title="Overrides & Publishing" icon={<Tune fontSize="small" color="primary" />}>
        <FieldRow name="word_count">Override the template's default word count for this schedule.</FieldRow>
        <FieldRow name="tone">Override the template's default tone.</FieldRow>
        <FieldRow name="post_status">
          What happens after generation. Two options:
        </FieldRow>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Review First (default):</strong> Posts land in the Review Queue for you to
            approve or reject before anything goes live.
          </Typography>
          <Typography variant="body2">
            <strong>Auto-Publish:</strong> Posts are published to your site immediately after generation.
            Only use this once you trust your template's output.
          </Typography>
        </Box>
        <FieldRow name="category_ids">Override categories for posts from this schedule.</FieldRow>
        <FieldRow name="tag_ids">Override tags for posts from this schedule.</FieldRow>
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ mt: 2, borderColor: '#B08D57', '& .MuiAlert-message': { color: '#2A2A2A' } }}
        >
          Activating a schedule requires the linked template to have non-empty experience_notes.
          This ensures every automated article has authentic E-E-A-T signals.
        </Alert>
      </SubCard>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section: Posts & Review
// ---------------------------------------------------------------------------

function PostsSection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Once your schedules generate content, posts flow into your review workflow.
        Here's how to manage them.
      </Typography>

      <SubCard title="Review Queue" icon={<Gavel fontSize="small" sx={{ color: '#B08D57' }} />}>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          The Review Queue is your editorial inbox. Posts with "Review First" status
          land here automatically after generation.
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Approve:</strong> Publishes the post to your connected site immediately.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Reject:</strong> Marks the post as rejected with your feedback notes.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Edit:</strong> Opens the post editor so you can make manual changes before deciding.
          </Typography>
          <Typography variant="body2">
            <strong>Bulk actions:</strong> Select multiple posts to approve or reject them all at once.
          </Typography>
        </Box>
        <Tip>
          Posts waiting more than 24 hours get a bronze timestamp highlight so you can spot
          a backlog at a glance.
        </Tip>
      </SubCard>

      <SubCard title="Revise with AI" icon={<AutoFixHigh fontSize="small" sx={{ color: '#B08D57' }} />}>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Don't like something about a generated post? Instead of editing manually, you can
          give the AI natural-language feedback and let it revise the article.
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Click <strong>"Revise with AI"</strong> on any post in the Review Queue or
            on draft posts.
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Describe what you want changed — e.g. "Make the intro punchier, add more data
            to section 3, tone down the conclusion."
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            The AI revises the article (preserving everything that works) and shows you a preview.
          </Typography>
          <Typography variant="body2">
            Accept the revision to save it, or click "Revise Again" to iterate further.
          </Typography>
        </Box>
        <Tip>
          Be specific in your feedback. "Make it better" gives the AI nothing to work with.
          "The third section needs a concrete example with real numbers" gets results.
        </Tip>
      </SubCard>

      <SubCard title="Content Calendar" icon={<CalendarMonth fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          The Content Calendar shows a monthly view of your publishing activity — past posts
          and upcoming scheduled runs. Use it to see what's coming and spot gaps in your
          content plan.
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>Color-coded chips:</strong> Green = scheduled, bronze = published,
            bronze outline = pending review, sienna = rejected.
          </Typography>
          <Typography variant="body2">
            <strong>Click any day</strong> to see a detailed list of posts and upcoming
            runs for that date, with links to post details.
          </Typography>
        </Box>
      </SubCard>

      <SubCard title="Skip Scheduled Runs" icon={<SkipNext fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Need to cancel a specific upcoming run without turning off the whole schedule?
          Click any future scheduled event on the Content Calendar and hit "Skip This Run."
        </Typography>
        <Typography variant="body2">
          Skipped runs appear dimmed with a strikethrough. You can restore them anytime
          before the date passes. The topic that was skipped becomes the next non-skipped
          run's topic — nothing is lost.
        </Typography>
      </SubCard>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section: Sites
// ---------------------------------------------------------------------------

function SitesSection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Sites are the publishing destinations for your content. Each platform has
        different credential requirements.
      </Typography>

      <SubCard title="WordPress" icon={<Language fontSize="small" color="primary" />}>
        <FieldRow name="url">Your site's URL (e.g. https://example.com).</FieldRow>
        <FieldRow name="api_url">
          WordPress REST API base URL. Usually your site URL + /wp-json/wp/v2
          (e.g. https://example.com/wp-json/wp/v2).
        </FieldRow>
        <FieldRow name="username">Your WordPress username (not email).</FieldRow>
        <FieldRow name="app_password">
          A WordPress Application Password. Generate one in WordPress under
          Users &rarr; Profile &rarr; Application Passwords. This is NOT your login password.
        </FieldRow>
        <Tip>
          Application Passwords are different from your WordPress login password. They're
          specific to API access and can be revoked individually.
        </Tip>
      </SubCard>

      <SubCard title="Shopify" icon={<Language fontSize="small" color="primary" />}>
        <FieldRow name="url">Your Shopify store URL (e.g. https://mystore.myshopify.com).</FieldRow>
        <FieldRow name="api_url">
          Shopify Admin API URL. Format: https://mystore.myshopify.com/admin/api/2026-01
        </FieldRow>
        <FieldRow name="api_key">
          Shopify Admin API access token. Create a custom app in your Shopify admin under
          Settings &rarr; Apps and sales channels &rarr; Develop apps.
        </FieldRow>
        <FieldRow name="default_blog_id">
          The blog to publish to. After connecting, select from your store's available blogs.
        </FieldRow>
      </SubCard>

      <SubCard title="Wix" icon={<Language fontSize="small" color="primary" />}>
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Wix integration is coming soon. The connection form is available but publishing
          is not yet live.
        </Typography>
        <FieldRow name="api_key">Wix API key (for future use).</FieldRow>
      </SubCard>

      <Alert
        severity="info"
        variant="outlined"
        icon={<CheckCircleOutline sx={{ color: '#4A7C6F' }} />}
        sx={{ mt: 2, borderColor: '#4A7C6F', '& .MuiAlert-message': { color: '#2A2A2A' } }}
      >
        After adding a site, use the "Test Connection" button to verify your credentials
        before setting up schedules.
      </Alert>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Section: Content Quality & Ranking
// ---------------------------------------------------------------------------

function QualitySection() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Acta AI has extensive built-in guardrails to ensure content reads as human-written,
        ranks well on Google, and performs in AI search engines (GEO). Here's how it works.
      </Typography>

      {/* Pipeline */}
      <SubCard title="Content Pipeline" icon={<AutoAwesome fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Every article goes through up to 6 distinct AI stages rather than a single prompt.
          This produces dramatically better results than one-shot generation.
        </Typography>
        {PIPELINE_STEPS.map((step) => (
          <Box key={step.num} sx={{ display: 'flex', mb: 2 }}>
            <Box
              sx={{
                minWidth: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#4A7C6F',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.85rem',
                mr: 2,
                flexShrink: 0,
              }}
            >
              {step.num}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{step.title}</Typography>
              <Typography variant="body2" color="text.secondary">{step.desc}</Typography>
            </Box>
          </Box>
        ))}
      </SubCard>

      {/* Experience System */}
      <SubCard title="Two-Layer Experience System" icon={<FormatQuote fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
          framework rewards content that demonstrates first-hand knowledge. Acta AI injects
          real experience at two levels:
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Template-level (experience_notes):</strong> Your general credentials and authority.
            This appears in every article generated from this template as the "Author's First-Hand
            Experience" context.
          </Typography>
          <Typography variant="body2">
            <strong>Topic-level (per-topic experience):</strong> Specific stories, data, or case
            studies relevant to one topic. Added on top of the template layer when that topic
            is generated.
          </Typography>
        </Box>
        <Tip>
          Good experience notes include: specific numbers ("handled 500+ client migrations"),
          timeframes ("over the last 8 years"), named tools or methods ("using the NIST framework"),
          and outcomes ("reduced downtime by 60%").
        </Tip>
      </SubCard>

      {/* Banned Phrases */}
      <SubCard title="Anti-Robot Guardrails" icon={<Shield fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          The system maintains a hardcoded list of 80+ banned words and phrases that are
          hallmarks of AI-generated content. These are always blocked — you can't turn
          them off. Your custom phrases_to_avoid list is merged on top.
        </Typography>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#A0522D' }}>
          Robotic Transitions
        </Typography>
        <BannedPhraseChips phrases={BANNED_TRANSITIONS} color="#A0522D" />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#8B6914' }}>
          AI-isms
        </Typography>
        <BannedPhraseChips phrases={BANNED_AI_ISMS} color="#8B6914" />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#6B4C8A' }}>
          Hedging
        </Typography>
        <BannedPhraseChips phrases={BANNED_HEDGING} color="#6B4C8A" />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#2D6B8A' }}>
          Journey & Power Phrases
        </Typography>
        <BannedPhraseChips phrases={BANNED_JOURNEY_POWER} color="#2D6B8A" />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#7A6B3A' }}>
          Overused Adjectives
        </Typography>
        <BannedPhraseChips phrases={BANNED_OVERUSED_ADJECTIVES} color="#7A6B3A" />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#5C5C5C' }}>
          Cliches
        </Typography>
        <BannedPhraseChips phrases={BANNED_CLICHES} color="#5C5C5C" />

        <Typography variant="body2" sx={{ mt: 1 }}>
          The AI is instructed to use natural alternatives instead: "Plus," "On top of that,"
          "Here's the thing," "The reality is."
        </Typography>
      </SubCard>

      {/* Personality Impact */}
      <SubCard title="Personality Level Impact" icon={<Psychology fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          The personality_level slider (1-10) fundamentally changes how the AI
          approaches the topic:
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 1, borderColor: '#E0DCD5', borderTop: '3px solid #6B9E8A' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>1-3: Factual</Typography>
            <Typography variant="body2" color="text.secondary">
              "Stay neutral and objective." Best for technical documentation, medical content,
              or compliance-sensitive industries.
            </Typography>
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 1, borderColor: '#E0DCD5', borderTop: '3px solid #B08D57' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>4-6: Balanced</Typography>
            <Typography variant="body2" color="text.secondary">
              "Take a clear position rather than hedging." The default. Good for most blog
              content — authoritative without being preachy.
            </Typography>
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: 2, borderColor: '#E0DCD5', borderTop: '3px solid #A0522D' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>7-10: Opinionated</Typography>
            <Typography variant="body2" color="text.secondary">
              "Be opinionated and take strong stances." Best for thought leadership, opinion
              pieces, and brands with strong identities. Pair with detailed experience notes.
            </Typography>
          </Paper>
        </Box>
      </SubCard>

      {/* E-E-A-T & GEO */}
      <SubCard title="Always-On Guardrails" icon={<CheckCircleOutline fontSize="small" color="primary" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          These rules are hardcoded into every generation — they're not configurable because
          they're essential for quality:
        </Typography>
        <Box sx={{ pl: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Writing Guardrails
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Banned phrases enforced, active voice default, varied sentence lengths, no
            consecutive paragraphs starting the same way.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Content Structure (GEO Optimized)
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Answer-first format: after each H2, a 40-60 word summary answers the section's
            core question before details. Modular passages that make sense if extracted
            independently by AI search engines. H2/H3 hierarchy, 2-4 sentence paragraphs.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Reasoning Approach
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Chain-of-thought priming: the AI outlines logical flow and key arguments before
            writing, identifies counterarguments, and ensures each section builds on the last.
          </Typography>
        </Box>
      </SubCard>

      {/* Tips */}
      <SubCard title="Tips for Effective System Prompts" icon={<TipsAndUpdates fontSize="small" sx={{ color: '#B08D57' }} />}>
        <List dense disablePadding>
          {[
            'Define WHO the AI is, not just what it should write. "You are a 20-year veteran plumber" beats "Write a plumbing article."',
            'Be specific about what NOT to do. "Never recommend DIY for gas line work" is more useful than "be safe."',
            "Don't repeat what the guardrails already handle. Focus on your unique brand voice and subject expertise.",
            'Include your audience\'s pain points. "Our readers are frustrated homeowners who\'ve been quoted $10K+ for renovations."',
            'Mention your differentiator. "Unlike most blogs, we always include cost breakdowns with real 2024 pricing."',
          ].map((tip, i) => (
            <Box key={i} sx={{ display: 'flex', mb: 1.5 }}>
              <Typography variant="body2" sx={{ color: '#B08D57', fontWeight: 800, mr: 1.5, flexShrink: 0 }}>
                {i + 1}.
              </Typography>
              <Typography variant="body2">{tip}</Typography>
            </Box>
          ))}
        </List>
      </SubCard>

      <SubCard title="Tips for Writing Experience Notes" icon={<TipsAndUpdates fontSize="small" sx={{ color: '#B08D57' }} />}>
        <List dense disablePadding>
          {[
            'Lead with credentials and timeframes: "12 years as a licensed contractor" not "I know construction."',
            'Include specific numbers: projects completed, revenue generated, team size managed.',
            'Name tools, frameworks, and methodologies you actually use.',
            'Describe outcomes: "reduced client acquisition costs by 35% across 40+ campaigns."',
            'For per-topic experience, add the exact story or data point you want in the article.',
          ].map((tip, i) => (
            <Box key={i} sx={{ display: 'flex', mb: 1.5 }}>
              <Typography variant="body2" sx={{ color: '#B08D57', fontWeight: 800, mr: 1.5, flexShrink: 0 }}>
                {i + 1}.
              </Typography>
              <Typography variant="body2">{tip}</Typography>
            </Box>
          ))}
        </List>
      </SubCard>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UserGuide() {
  const [expanded, setExpanded] = useState(false);
  const sectionRefs = useRef({});

  const handleTocClick = useCallback((sectionId) => {
    setExpanded(sectionId);
    // Small delay so the accordion opens before we scroll
    setTimeout(() => {
      sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  const handleAccordionChange = (sectionId) => (_event, isExpanded) => {
    setExpanded(isExpanded ? sectionId : false);
  };

  const SECTION_COMPONENTS = {
    'getting-started': <GettingStartedSection />,
    templates: <TemplatesSection />,
    schedules: <SchedulesSection />,
    posts: <PostsSection />,
    sites: <SitesSection />,
    quality: <QualitySection />,
  };

  return (
    <Box>
      {/* Page title */}
      <Typography
        variant="h4"
        sx={{
          mb: 1,
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -6,
            left: 0,
            width: '100%',
            height: 3,
            background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
          },
        }}
      >
        User Guide
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 4 }}>
        Everything you need to know about configuring templates, schedules, sites, and
        getting the best possible content out of the AI pipeline.
      </Typography>

      {/* Table of Contents */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Typography sx={{ ...sectionHeaderSx, mb: 2 }}>Contents</Typography>
          <Grid container spacing={1}>
            {SECTIONS.map((s) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.id}>
                <ListItemButton
                  onClick={() => handleTocClick(s.id)}
                  sx={{
                    py: 1,
                    '&:hover': { bgcolor: 'rgba(74, 124, 111, 0.08)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: '#4A7C6F' }}>
                    {s.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={s.label}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                  />
                </ListItemButton>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Accordion sections */}
      {SECTIONS.map((s) => (
        <Accordion
          key={s.id}
          square
          expanded={expanded === s.id}
          onChange={handleAccordionChange(s.id)}
          ref={(el) => { sectionRefs.current[s.id] = el; }}
          sx={{
            border: '1px solid #E0DCD5',
            borderTop: '3px solid #B08D57',
            boxShadow: 'none',
            mb: 2,
            '&::before': { display: 'none' },
            '&.Mui-expanded': { margin: '0 0 16px 0' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              minHeight: 64,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                gap: 1.5,
              },
            }}
          >
            <Box sx={{ color: '#4A7C6F', display: 'flex', alignItems: 'center' }}>
              {s.icon}
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontSize: '1.05rem',
              }}
            >
              {s.label}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Divider sx={{ mb: 3 }} />
            {SECTION_COMPONENTS[s.id]}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
