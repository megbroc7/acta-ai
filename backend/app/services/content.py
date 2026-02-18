"""Optimized AI content generation pipeline.

Title stage: Generate 5 headline variants (How-To, Contrarian, Listicle, Experience, Direct Benefit)
Article stage: 3-step chain (Outline → Draft → Review/Polish)

Uses OpenAI GPT-4o for all stages. Designed to be called by
the scheduler (generate_post) or individually via test endpoints.
"""

import asyncio
import logging
import random
import re
from dataclasses import dataclass
from html.parser import HTMLParser

import markdown
from markdownify import markdownify as md
from openai import APIConnectionError, APITimeoutError, AsyncOpenAI, RateLimitError

from app.core.config import settings
from app.models.prompt_template import PromptTemplate

logger = logging.getLogger(__name__)

# --- Constants ---

MODEL = "gpt-4o"
TITLE_TIMEOUT = 30
TITLE_MAX_TOKENS = 500
OUTLINE_TIMEOUT = 30
OUTLINE_MAX_TOKENS = 2500
DRAFT_TIMEOUT = 120
DRAFT_MAX_TOKENS = 4000
REVIEW_TIMEOUT = 120
REVIEW_MAX_TOKENS = 4500
REVISION_TIMEOUT = 120
REVISION_MAX_TOKENS = 4500
INTERVIEW_TIMEOUT = 30
INTERVIEW_MAX_TOKENS = 800
META_TIMEOUT = 20
META_MAX_TOKENS = 500
MAX_RETRIES = 2
MARKDOWN_EXTENSIONS = ["extra", "codehilite", "toc", "nl2br"]

# --- Cost calculation (GPT-4o pricing as of 2026) ---
GPT4O_INPUT_COST = 2.50 / 1_000_000    # $2.50 per 1M input tokens
GPT4O_OUTPUT_COST = 10.00 / 1_000_000   # $10.00 per 1M output tokens
DALLE3_COST = 0.04                       # per standard image

# Hardcoded anti-robot banned phrases — always included in system prompt.
# Organized by AI-tell category. ~70 phrases total (expanded in Session 15).
BANNED_TRANSITIONS = [
    "Moreover,", "Furthermore,", "Additionally,", "In conclusion,",
    "It is worth noting", "Consequently,", "In summary,",
    "It's important to note", "It should be noted",
    "With that being said,", "That said,", "Having said that,",
]
BANNED_AI_ISMS = [
    "delve", "harness", "leverage", "crucial", "landscape", "tapestry",
    "multifaceted", "holistic", "paradigm", "synergy", "robust",
    "streamline", "utilize", "facilitate", "encompasses",
    "navigate", "elevate", "foster", "empower", "optimize",
    "spearhead", "bolster", "underscores", "underpins",
]
BANNED_HEDGING = [
    "it appears that", "it seems that", "generally speaking",
    "it could be argued", "some might say", "one could argue",
    "it is widely believed", "many experts agree",
    "it is generally accepted", "arguably",
]
BANNED_JOURNEY_POWER = [
    "unlock", "unleash", "unlock the power", "unlock the potential",
    "embark on a journey", "navigate the landscape",
    "dive deep", "deep dive into", "take a deep dive",
    "the power of", "the art of", "the secret to",
    "revolutionize", "transformative", "cutting-edge",
]
BANNED_OVERUSED_ADJECTIVES = [
    "seamless", "seamlessly", "invaluable", "groundbreaking",
    "ever-evolving", "ever-changing", "vibrant", "intricate",
    "comprehensive", "pivotal", "myriad",
]
BANNED_CLICHES = [
    "In today's fast-paced world,", "In today's digital landscape,",
    "game-changing", "game-changer", "It is important to note",
    "at the end of the day", "when it comes to",
    "without further ado", "in the realm of",
    "look no further", "whether you're a seasoned",
    "Imagine", "Picture this", "Have you ever wondered",
]
BANNED_PHRASES = (
    BANNED_TRANSITIONS + BANNED_AI_ISMS + BANNED_HEDGING
    + BANNED_JOURNEY_POWER + BANNED_OVERUSED_ADJECTIVES + BANNED_CLICHES
)

TITLE_TYPES = ["HOW-TO", "CONTRARIAN", "LISTICLE", "EXPERIENCE", "DIRECT BENEFIT"]

# --- Headline Style constants ---

HEADLINE_STYLES = [
    "how_to", "contrarian", "listicle", "experience", "direct_benefit", "ai_selected",
]

# Weights for ai_selected mode: how-to 25%, contrarian 5%, listicle 35%, experience 20%, direct benefit 15%
AI_SELECTED_WEIGHTS = [25, 5, 35, 20, 15]

CONTENT_TYPE_DISPLAY = {
    "how_to": "how-to guides",
    "contrarian": "contrarian opinion pieces",
    "listicle": "listicle articles",
    "experience": "experience-driven articles",
    "direct_benefit": "benefit-focused articles",
    "ai_selected": None,  # omit from role sentence
}

LEGACY_CONTENT_TYPE_MAP = {
    "blog_post": "ai_selected",
    "article": "ai_selected",
    "tutorial": "how_to",
    "listicle": "listicle",
    "how_to": "how_to",
    "review": "experience",
}


def resolve_content_type(raw: str | None) -> str:
    """Map legacy or null content_type values to a valid headline style."""
    if not raw:
        return "ai_selected"
    if raw in HEADLINE_STYLES:
        return raw
    return LEGACY_CONTENT_TYPE_MAP.get(raw, "ai_selected")

# Contrastive examples — good vs bad paragraph pairs for the system prompt.
# Research (Session 7): 2-4 pairs max, show structural differences not just
# vocabulary, place near end of prompt to avoid "lost in the middle" effect.
CONTRASTIVE_EXAMPLES = (
    "## Writing Examples (Do NOT copy these — internalize the patterns)\n\n"
    "### BAD — Hypothetical AI opening\n"
    "Imagine you're a business owner trying to grow your online presence. "
    "Picture yourself scrolling through your analytics, wondering why your "
    "content isn't getting traction. What if there was a better way?\n\n"
    "### GOOD — Lead with substance\n"
    "Companies that publish 2-4 long-form posts per week see 3.5x more organic "
    "traffic than those posting daily short pieces. The difference isn't volume — "
    "it's depth. Here's how that plays out in practice.\n\n"
    "### BAD — Passive hedging\n"
    "It could be argued that website speed is considered to be a somewhat important "
    "factor that may potentially impact user experience. Some experts suggest that "
    "faster load times might generally lead to better outcomes for most businesses.\n\n"
    "### GOOD — Active, concrete\n"
    "A one-second delay in page load kills 7% of conversions. We measured this "
    "across 40 client sites last quarter. The fix took two hours — lazy-loading "
    "images and deferring three render-blocking scripts.\n\n"
    "### BAD — Monotonous rhythm\n"
    "Content marketing is very important. Content marketing drives organic traffic. "
    "Content marketing builds brand authority. Content marketing generates leads. "
    "Content marketing should be part of every strategy.\n\n"
    "### GOOD — Varied burstiness\n"
    "Content marketing works. Not because some guru said so — because the math is "
    "brutal. Paid ads stop the moment your budget does. But a single well-researched "
    "article? It compounds. One post we published in March still drives 1,200 visits "
    "a month, eighteen months later."
)


# --- OpenAI response wrapper + token tracking ---


@dataclass
class OpenAIResponse:
    text: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class TokenAccumulator:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def add(self, resp: OpenAIResponse):
        self.prompt_tokens += resp.prompt_tokens
        self.completion_tokens += resp.completion_tokens
        self.total_tokens += resp.total_tokens


# --- Return types ---


@dataclass
class TitleResult:
    titles: list[str]
    title_system_prompt_used: str
    topic_prompt_used: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class ContentResult:
    content_markdown: str
    content_html: str
    excerpt: str
    system_prompt_used: str
    content_prompt_used: str
    outline_used: str
    featured_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    image_alt_text: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class RevisionResult:
    content_markdown: str
    content_html: str
    excerpt: str
    revision_prompt_used: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class SeoMetaResult:
    meta_title: str
    meta_description: str
    image_alt_text: str | None


@dataclass
class GenerationResult:
    title: str
    titles_generated: list[str]
    content_markdown: str
    content_html: str
    excerpt: str
    system_prompt_used: str
    topic_prompt_used: str
    content_prompt_used: str
    outline_used: str
    featured_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    image_alt_text: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


# --- Helper: strip HTML tags ---


class _TagStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data):
        self._parts.append(data)

    def get_text(self):
        return "".join(self._parts)


def _strip_tags(html: str) -> str:
    stripper = _TagStripper()
    stripper.feed(html)
    return stripper.get_text()


# --- Prompt builders ---

PERSPECTIVE_MAP = {
    "first_person_singular": "Write in first person singular (I/me/my)",
    "first_person_plural": "Write in first person plural (we/us/our)",
    "second_person": "Write in second person, addressing the reader directly (you/your)",
    "third_person": "Write in third person (he/she/they/one)",
}


def build_title_system_prompt(template: PromptTemplate) -> str:
    """Build a specialized system prompt for generating 5 headline variants."""
    style = resolve_content_type(template.content_type)

    industry_line = ""
    if template.industry:
        industry_line = f"\nYou specialize in the {template.industry} industry."

    keyword_line = ""
    if template.seo_focus_keyword:
        keyword_line = (
            f"\nSEO focus keyword: \"{template.seo_focus_keyword}\". "
            "Incorporate this keyword's core concept naturally — do NOT force "
            "the exact phrase into every title. Adapt, abbreviate, or rephrase "
            "to fit the headline style."
        )

    header = (
        "You are a Senior SEO Copywriter & Viral Content Strategist.\n"
        f"{industry_line}{keyword_line}\n\n"
        "## Task\n"
        "Generate exactly 5 headline variants for the given topic. "
        "Each title MUST be under 60 characters. "
        "Prioritize click-worthy, natural-sounding headlines over "
        "keyword stuffing.\n\n"
    )

    if style == "ai_selected":
        # Original mixed-type format
        type_section = (
            "## Required Headline Types (in this order)\n"
            "1. HOW-TO — Actionable, starts with 'How to' or similar instructional framing\n"
            '   Example: "How to Cut Cloud Costs by 40% Without Downtime"\n'
            "2. CONTRARIAN — Challenges conventional wisdom, uses 'Why X Is Wrong' or 'Stop Doing Y'\n"
            '   Example: "Why Most SEO Advice Is Costing You Traffic"\n'
            "3. LISTICLE — Numbered list, specific count, promises scannable value\n"
            '   Example: "7 Cache Strategies Senior Devs Actually Use"\n'
            "4. EXPERIENCE — First-person or story-driven, implies lived expertise\n"
            '   Example: "I Migrated 200 Sites to Headless — Here\'s What Broke"\n'
            "5. DIRECT BENEFIT — Leads with the reader's outcome, clear and specific\n"
            '   Example: "Rank on Page 1 in 90 Days With This Content Framework"\n'
        )
    else:
        # Single-style: all 5 titles match the selected style
        style_instructions = {
            "how_to": (
                "Generate exactly 5 distinct HOW-TO headlines.\n"
                "Each should be actionable and start with 'How to' or similar instructional framing.\n"
                'Examples: "How to Cut Cloud Costs by 40% Without Downtime", '
                '"How to Audit Your SEO in Under an Hour"'
            ),
            "contrarian": (
                "Generate exactly 5 distinct CONTRARIAN headlines.\n"
                "Each should challenge conventional wisdom, using 'Why X Is Wrong', 'Stop Doing Y', "
                "or a surprising counter-take.\n"
                'Examples: "Why Most SEO Advice Is Costing You Traffic", '
                '"Stop A/B Testing Your Headlines — Do This Instead"'
            ),
            "listicle": (
                "Generate exactly 5 distinct LISTICLE headlines.\n"
                "Each should use a numbered list with a specific count and promise scannable value.\n"
                'Examples: "7 Cache Strategies Senior Devs Actually Use", '
                '"11 Email Subject Lines That Got 40%+ Open Rates"'
            ),
            "experience": (
                "Generate exactly 5 distinct EXPERIENCE headlines.\n"
                "Each should be first-person or story-driven, implying lived expertise.\n"
                'Examples: "I Migrated 200 Sites to Headless — Here\'s What Broke", '
                '"What 10 Years of Freelancing Taught Me About Pricing"'
            ),
            "direct_benefit": (
                "Generate exactly 5 distinct DIRECT BENEFIT headlines.\n"
                "Each should lead with the reader's outcome — clear, specific, and compelling.\n"
                'Examples: "Rank on Page 1 in 90 Days With This Content Framework", '
                '"Double Your Email List Without Paid Ads"'
            ),
        }
        type_section = f"## Headline Style\n{style_instructions[style]}\n"

    footer = (
        "\n## Format\n"
        "Return exactly 5 titles, numbered 1-5, one per line. "
        "No extra commentary, no quotes around titles."
    )

    return header + type_section + footer


def build_content_system_prompt(
    template: PromptTemplate,
    experience_context: str | None = None,
) -> str:
    """Build system prompt from structured fields + optional custom instructions."""
    # Role — built entirely from structured fields
    industry = template.industry or "the subject matter"
    style = resolve_content_type(template.content_type)
    display_type = CONTENT_TYPE_DISPLAY.get(style)

    role_parts = [
        f"You are a subject matter expert with 15+ years of hands-on experience in {industry}",
    ]
    if display_type:
        role_parts.append(f"specializing in writing {display_type}")
    if template.audience_level:
        role_parts.append(f"for a {template.audience_level} audience")
    role = ", ".join(role_parts) + "."
    sections: list[str] = [role]

    # Custom instructions (user-provided additional context)
    if template.system_prompt and template.system_prompt.strip():
        sections.append(
            f"## Additional Instructions\n{template.system_prompt.strip()}"
        )

    # --- Author's First-Hand Experience (from interview + template notes) ---
    if experience_context and experience_context.strip():
        experience_section = (
            "## Author's First-Hand Experience\n"
            "The following are real experiences and data points from the author. "
            "Weave these naturally into the article as first-person evidence. "
            "Do NOT paraphrase them into generic advice — use the specific "
            "details provided.\n\n"
            f"{experience_context.strip()}"
        )
        sections.append(experience_section)

    # --- E-E-A-T Experience Injection (always-on) ---
    eeat = (
        "## E-E-A-T Experience Signals\n"
        "Ground every major claim in a specific scenario, hypothetical case study, "
        "or real-world example. Use active voice throughout — write 'We analyzed' "
        "not 'The data was analyzed.' Reference concrete numbers, timeframes, "
        "or outcomes where possible to demonstrate first-hand expertise."
    )
    sections.append(eeat)

    # --- Content Guidelines ---
    guidelines: list[str] = []
    if display_type:
        guidelines.append(f"Content type: {display_type}")
    if template.writing_style:
        guidelines.append(f"Writing style: {template.writing_style}")
    if template.industry:
        guidelines.append(f"Industry/niche: {template.industry}")
    if template.audience_level:
        guidelines.append(f"Audience level: {template.audience_level}")
    if template.target_reader:
        guidelines.append(f"Target reader: {template.target_reader}")
    if template.call_to_action:
        guidelines.append(f"Call to action: Naturally guide readers toward: {template.call_to_action}")
    if guidelines:
        sections.append("## Content Guidelines\n" + "\n".join(guidelines))

    # --- Voice & Style ---
    voice: list[str] = []
    if template.perspective and template.perspective in PERSPECTIVE_MAP:
        voice.append(PERSPECTIVE_MAP[template.perspective])
    if template.brand_voice_description:
        voice.append(f"Brand voice: {template.brand_voice_description}")
    if template.personality_level is not None:
        if template.personality_level >= 7:
            voice.append("Be opinionated and take strong stances. Avoid neutral hedging.")
        elif template.personality_level >= 4:
            voice.append(
                "Take a clear position rather than hedging with "
                "'some might say' or 'it depends.'"
            )
        else:
            voice.append("Stay neutral and objective.")
    if template.use_anecdotes:
        voice.append("Include personal anecdotes and stories where appropriate.")
    if template.use_rhetorical_questions:
        voice.append("Use rhetorical questions to engage the reader.")
    if template.use_humor:
        voice.append("Incorporate humor where appropriate.")
    if template.use_contractions is False:
        voice.append("Do NOT use contractions (write \"do not\" instead of \"don't\").")
    if voice:
        sections.append("## Voice & Style\n" + "\n".join(voice))

    # --- SEO Instructions ---
    seo: list[str] = []
    if template.seo_focus_keyword:
        seo.append(f"Focus keyword: {template.seo_focus_keyword}")
    if template.seo_keywords:
        seo.append(f"Secondary keywords: {', '.join(template.seo_keywords)}")
    if template.seo_keyword_density:
        seo.append(f"Target keyword density: {template.seo_keyword_density}")
    if template.seo_meta_description_style:
        seo.append(f"Meta description style: {template.seo_meta_description_style}")
    if template.seo_internal_linking_instructions:
        seo.append(f"Internal linking: {template.seo_internal_linking_instructions}")
    if seo:
        sections.append("## SEO Instructions\n" + "\n".join(seo))

    # --- Writing Guardrails (always-on anti-robot) ---
    all_banned = list(BANNED_PHRASES)
    if template.phrases_to_avoid:
        hardcoded_lower = {p.lower() for p in BANNED_PHRASES}
        for phrase in template.phrases_to_avoid:
            if phrase.lower() not in hardcoded_lower:
                all_banned.append(phrase)

    preferred_line = ""
    if template.preferred_terms:
        preferred_line = (
            f"\nALWAYS use these preferred terms: {', '.join(template.preferred_terms)}."
        )

    guardrails = (
        "## Writing Guardrails\n"
        f"NEVER use these words or phrases: {', '.join(all_banned)}\n"
        "Use conversational alternatives instead: \"Plus,\" \"On top of that,\" "
        "\"Here's the thing,\" \"The reality is.\"\n"
        "Vary sentence length deliberately — mix short punchy fragments with "
        "longer complex sentences. Break symmetrical patterns. "
        "Do not start consecutive paragraphs the same way.\n"
        "Default to active voice. Avoid passive constructions.\n"
        "OPENING PARAGRAPH: NEVER open an article with a hypothetical scenario, "
        "rhetorical question, or reader address (e.g. \"Imagine...\", \"Picture "
        "yourself...\", \"Have you ever...\", \"What if...\", \"You're standing...\"). "
        "Instead, open with a concrete fact, a bold claim, a surprising statistic, "
        "a real-world example, or a direct answer to the topic. "
        "Lead with substance, not a setup."
    )
    if preferred_line:
        guardrails += preferred_line
    sections.append(guardrails)

    # --- Contrastive Examples (good vs bad paragraph pairs) ---
    sections.append(CONTRASTIVE_EXAMPLES)

    # --- Content Structure (GEO optimization) ---
    structure = (
        "## Content Structure\n"
        "Answer-first: After each H2, open with a direct 40-60 word summary "
        "that answers the section's core question before diving into detail. "
        "This is critical for answer-engine extraction.\n"
        "Modular passages: Write in self-contained knowledge blocks — each "
        "section should make sense if extracted independently by an AI search engine.\n"
        "Scannable hierarchy: Use H2 for main sections, H3 for subsections, "
        "and keep paragraphs to 2-4 sentences max."
    )
    sections.append(structure)

    # --- Reasoning Approach (chain-of-thought priming) ---
    reasoning = (
        "## Reasoning Approach\n"
        "Before writing, internally outline the logical flow and key arguments.\n"
        "Identify and address likely counterarguments.\n"
        "Ensure each section builds on the previous one rather than repeating "
        "the same point."
    )
    sections.append(reasoning)

    return "\n\n".join(sections)


# --- Utility functions ---


def _strip_code_fences(text: str) -> str:
    """Strip markdown code fences that GPT sometimes wraps responses in."""
    stripped = text.strip()
    if stripped.startswith("```"):
        # Remove opening fence (with optional language tag like ```markdown)
        stripped = re.sub(r"^```\w*\n?", "", stripped, count=1)
        # Remove closing fence
        stripped = re.sub(r"\n?```\s*$", "", stripped, count=1)
    return stripped.strip()


def clean_title(raw: str) -> str:
    """Clean AI-generated title: strip quotes, markdown, prefixes, etc."""
    title = raw.strip()
    # Strip leading "# " markdown headings
    title = re.sub(r"^#+\s*", "", title)
    # Strip "Title:" prefix (case-insensitive)
    title = re.sub(r"^title:\s*", "", title, flags=re.IGNORECASE)
    # Strip surrounding quotes (straight and smart)
    title = re.sub(r'^["\u201c\u201d\u2018\u2019\']+|["\u201c\u201d\u2018\u2019\']+$', "", title)
    # Strip markdown bold/italic
    title = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", title)
    title = re.sub(r"_{1,3}(.*?)_{1,3}", r"\1", title)
    # Strip trailing period (but not ellipsis)
    if title.endswith(".") and not title.endswith("..."):
        title = title[:-1]
    return title.strip()


def _parse_numbered_titles(raw: str) -> list[str]:
    """Parse numbered titles from AI response (e.g., '1. Title here')."""
    print(f"[TITLE DEBUG] Raw title response:\n{raw}")
    titles = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # Strip leading numbering: "1.", "1)", "1:", "1 -", etc.
        cleaned = re.sub(r"^\d+[\.\)\:\-]\s*", "", line)
        # Strip type labels: "HOW-TO:", "CONTRARIAN —", "**LISTICLE:**", etc.
        cleaned = re.sub(
            r"^[\*_]{0,3}(HOW[\-\s]?TO|CONTRARIAN|LISTICLE|EXPERIENCE|DIRECT\s*BENEFIT)"
            r"[\*_]{0,3}\s*[\:\—\-–]+\s*",
            "", cleaned, flags=re.IGNORECASE,
        )
        if cleaned:
            titles.append(clean_title(cleaned))
    return titles


def markdown_to_html(content: str) -> str:
    """Convert markdown to HTML, stripping any leading <h1>."""
    html = markdown.markdown(content, extensions=MARKDOWN_EXTENSIONS)
    # Strip leading <h1>...</h1> — the title is handled separately
    html = re.sub(r"^\s*<h1>.*?</h1>\s*", "", html, count=1)
    return html


def extract_excerpt(html: str, max_length: int = 160) -> str:
    """Extract a plain-text excerpt from HTML content."""
    text = _strip_tags(html).strip()
    if not text:
        return ""
    if len(text) <= max_length:
        return text

    # Try to find a sentence boundary near max_length
    min_length = int(max_length * 0.4)
    candidate = text[:max_length]

    # Search for last sentence-ending punctuation in candidate
    last_sentence_end = -1
    for i in range(len(candidate) - 1, min_length - 1, -1):
        if candidate[i] in ".!?":
            last_sentence_end = i
            break

    if last_sentence_end > 0:
        return candidate[: last_sentence_end + 1]

    # Fallback: word boundary
    last_space = candidate.rfind(" ")
    if last_space > min_length:
        return candidate[:last_space] + "..."
    return candidate + "..."


# --- OpenAI caller ---


async def _call_openai(
    system_prompt: str,
    user_prompt: str,
    model: str = MODEL,
    timeout: int = DRAFT_TIMEOUT,
    max_tokens: int = DRAFT_MAX_TOKENS,
    max_retries: int = MAX_RETRIES,
    temperature: float = 0.7,
) -> OpenAIResponse:
    """Call OpenAI with retry logic for transient errors. Returns text + token usage."""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout)

    for attempt in range(max_retries + 1):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            usage = response.usage
            return OpenAIResponse(
                text=response.choices[0].message.content.strip(),
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            )
        except (APIConnectionError, APITimeoutError, RateLimitError) as e:
            if attempt == max_retries:
                raise
            wait = 2**attempt  # 1s, 2s
            logger.warning(
                f"OpenAI transient error (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                f"Retrying in {wait}s..."
            )
            await asyncio.sleep(wait)


# --- Stage 1: Title generation (5 variants) ---


async def generate_titles(
    template: PromptTemplate,
    topic: str,
    replacements: dict[str, str] | None = None,
    existing_titles: list[str] | None = None,
) -> TitleResult:
    """Generate 5 headline variants from a topic/idea."""
    system_prompt = build_title_system_prompt(template)

    # Keep the user prompt simple — just the topic.
    # All structural instructions live in the system prompt to avoid conflicts.
    topic_prompt = f"Topic: {topic}"

    # Deduplication: tell the AI what's already been published
    if existing_titles:
        titles_list = "\n".join(f"- {t}" for t in existing_titles)
        topic_prompt += (
            f"\n\nALREADY PUBLISHED (do NOT reuse or closely rephrase these titles):\n"
            f"{titles_list}"
        )

    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=topic_prompt,
        timeout=TITLE_TIMEOUT,
        max_tokens=TITLE_MAX_TOKENS,
        temperature=0.8,
    )

    titles = _parse_numbered_titles(resp.text)
    print(f"[TITLE DEBUG] Parsed {len(titles)} titles: {titles}")

    # Fallback: if parsing yields fewer than 5, pad with what we got
    if not titles:
        print(f"[TITLE DEBUG] WARNING: 0 parsed titles. Raw: {resp.text[:300]}")
        titles = [clean_title(resp.text)]
    while len(titles) < 5:
        titles.append(titles[-1])

    return TitleResult(
        titles=titles[:5],
        title_system_prompt_used=system_prompt,
        topic_prompt_used=topic_prompt,
        prompt_tokens=resp.prompt_tokens,
        completion_tokens=resp.completion_tokens,
        total_tokens=resp.total_tokens,
    )


# --- Stage 1.5: Interview question generation ---


async def generate_interview(
    template: PromptTemplate,
    title: str,
) -> list[str]:
    """Generate 3-5 targeted interview questions to extract real expertise."""
    industry = template.industry or "their field"

    system_prompt = (
        "You are an editorial researcher preparing to interview a subject matter "
        "expert. Your goal is to extract specific, concrete, first-hand experience "
        "that will make the article authentic and impossible for a generic AI to "
        "fabricate."
    )

    user_prompt = (
        f"Generate 3-5 focused interview questions for an author writing an "
        f"article titled '{title}' in the {industry} space.\n\n"
        "Each question should ask for: specific numbers, timeframes, failures, "
        "surprising findings, or personal decisions.\n"
        "Avoid generic questions.\n"
        "Return only the questions, numbered 1-5, one per line."
    )

    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=INTERVIEW_TIMEOUT,
        max_tokens=INTERVIEW_MAX_TOKENS,
        temperature=0.7,
    )

    questions = _parse_numbered_titles(resp.text)
    return questions[:5] if questions else [resp.text.strip()]


# --- Stage 1.6: Template-level experience interview ---


async def generate_template_interview(
    template: PromptTemplate,
) -> list[str]:
    """Generate 5 broad expertise questions based on template context (industry, role, content type).

    Unlike generate_interview() which is title-specific and used in the test panel,
    this generates template-level questions that cover the author's general authority.
    """
    industry = template.industry or "their field"
    style = resolve_content_type(template.content_type)
    content_type = CONTENT_TYPE_DISPLAY.get(style) or "blog posts"
    audience = template.audience_level or "general"

    system_prompt = (
        "You are an editorial strategist preparing to onboard a new author. "
        "Your goal is to extract broad expertise signals — credentials, track record, "
        "specific experiences, and unique insights — that will make ALL their future "
        "articles authentic and impossible for a generic AI to fabricate."
    )

    context_parts = [f"Industry: {industry}", f"Content type: {content_type}"]
    if template.audience_level:
        context_parts.append(f"Audience level: {audience}")
    if template.system_prompt and template.system_prompt.strip():
        context_parts.append(f"Additional context: {template.system_prompt.strip()[:200]}")
    author_context = "\n".join(context_parts)

    user_prompt = (
        f"Generate exactly 5 interview questions for an author who writes {content_type} "
        f"in the {industry} space.\n\n"
        f"Author context:\n{author_context}\n\n"
        "Each question should ask for ONE of these:\n"
        "1. Professional credentials or years of experience\n"
        "2. A specific project, case study, or measurable outcome\n"
        "3. A common misconception they've seen firsthand\n"
        "4. A failure or lesson learned the hard way\n"
        "5. What makes their approach different from the mainstream\n\n"
        "Make questions specific to their industry — not generic.\n"
        "Return only the questions, numbered 1-5, one per line."
    )

    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=INTERVIEW_TIMEOUT,
        max_tokens=INTERVIEW_MAX_TOKENS,
        temperature=0.7,
    )

    questions = _parse_numbered_titles(resp.text)
    return questions[:5] if questions else [resp.text.strip()]


VOICE_ANALYSIS_TIMEOUT = 30
VOICE_ANALYSIS_MAX_TOKENS = 1000

ALLOWED_TONES = [
    "informative", "conversational", "professional", "friendly",
    "authoritative", "witty", "empathetic", "inspirational", "casual", "formal",
]

ALLOWED_PERSPECTIVES = ["first_person", "second_person", "third_person", ""]


async def analyze_writing_voice(writing_sample: str) -> dict:
    """Analyze a writing sample to detect voice/tone characteristics.

    Returns a dict with detected voice fields matching PromptTemplate columns,
    plus confidence and summary for user feedback.
    """
    import json as _json

    # Truncate to ~5,000 words to keep costs reasonable
    words = writing_sample.split()
    if len(words) > 5000:
        writing_sample = " ".join(words[:5000])

    system_prompt = (
        "You are a writing style analyst. Given a writing sample, analyze the author's "
        "voice, tone, and stylistic patterns. Return your analysis as a JSON object — "
        "no markdown fences, no commentary, just the JSON."
    )

    allowed_tones_str = ", ".join(ALLOWED_TONES)
    user_prompt = (
        f"Analyze this writing sample and return a JSON object with these exact fields:\n\n"
        f'{{\n'
        f'  "tone": one of [{allowed_tones_str}],\n'
        f'  "personality_level": integer 1-10 (1=strictly factual, 5=balanced, 10=very opinionated),\n'
        f'  "perspective": one of ["first_person", "second_person", "third_person", ""],\n'
        f'  "brand_voice_description": 1-2 sentence description of their unique voice,\n'
        f'  "use_anecdotes": boolean — does the author use personal stories or examples?,\n'
        f'  "use_rhetorical_questions": boolean — does the author use rhetorical questions?,\n'
        f'  "use_humor": boolean — does the author use humor or wit?,\n'
        f'  "use_contractions": boolean — does the author use contractions (don\'t, it\'s, etc.)?,\n'
        f'  "confidence": "low" if sample is very short or ambiguous, "medium" if decent sample, "high" if long + clear patterns,\n'
        f'  "summary": plain-English 1-2 sentence summary of the detected writing style\n'
        f'}}\n\n'
        f"WRITING SAMPLE:\n\n{writing_sample}"
    )

    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=VOICE_ANALYSIS_TIMEOUT,
        max_tokens=VOICE_ANALYSIS_MAX_TOKENS,
        temperature=0.3,
    )

    # Parse and validate the response
    raw = _strip_code_fences(resp.text)
    try:
        result = _json.loads(raw)
    except _json.JSONDecodeError:
        logger.error(f"Voice analysis returned invalid JSON: {raw[:200]}")
        raise ValueError("AI returned invalid response — please try again")

    # Validate and clamp all fields
    tone = result.get("tone", "informative")
    if tone not in ALLOWED_TONES:
        tone = "informative"

    personality = result.get("personality_level", 5)
    if not isinstance(personality, int) or personality < 1 or personality > 10:
        personality = 5

    perspective = result.get("perspective", "")
    if perspective not in ALLOWED_PERSPECTIVES:
        perspective = ""

    confidence = result.get("confidence", "medium")
    if confidence not in ("low", "medium", "high"):
        confidence = "medium"

    return {
        "tone": tone,
        "personality_level": personality,
        "perspective": perspective,
        "brand_voice_description": str(result.get("brand_voice_description", ""))[:500],
        "use_anecdotes": bool(result.get("use_anecdotes", False)),
        "use_rhetorical_questions": bool(result.get("use_rhetorical_questions", False)),
        "use_humor": bool(result.get("use_humor", False)),
        "use_contractions": bool(result.get("use_contractions", True)),
        "confidence": confidence,
        "summary": str(result.get("summary", ""))[:300],
    }


def format_experience_qa(qa_pairs: list[dict]) -> str:
    """Format Q&A pairs into readable plain text for experience_notes.

    Only includes pairs where the answer is non-empty.
    """
    parts = []
    for pair in qa_pairs:
        answer = pair.get("answer", "").strip()
        if answer:
            parts.append(answer)
    return "\n\n".join(parts) if parts else ""


# --- Stage 2: Article generation (3-step chain) ---


async def _generate_outline(
    system_prompt: str,
    title: str,
    word_count: int,
    tokens: TokenAccumulator | None = None,
) -> str:
    """Step 1 of article chain: generate a structured outline."""
    # Reserve ~250 words for intro + conclusion, split rest across sections
    body_budget = word_count - 250
    user_prompt = (
        f"Create a detailed outline for a {word_count}-word article titled '{title}'.\n\n"
        "## Structure\n"
        "- Introduction (~125 words): Hook + thesis statement\n"
        "- 3-5 H2 sections (main body): Each framed as a question readers care about\n"
        "- Conclusion (~125 words): One specific, actionable next step — NOT a summary\n\n"
        "## For Each H2 Section, Provide:\n"
        "1. **Header** as a reader question or clear angle\n"
        f"2. **Word budget** — distribute ~{body_budget} words across all sections "
        "(state the budget for each, e.g. '~350 words')\n"
        "3. **Answer statement** (40-60 words) — the direct answer that will OPEN "
        "the section before any supporting detail (inverted pyramid)\n"
        "4. **Key points** (2-3) — supporting evidence, examples, or sub-arguments\n"
        "5. **Data marker** — one place where a statistic, number, or citation "
        "would strengthen credibility\n"
        "6. **Transition hook** — one sentence showing how this section connects "
        "to the next (use conversational connectors, not 'Moreover' or 'Furthermore')\n\n"
        "Return ONLY the outline in the format above."
    )
    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=OUTLINE_TIMEOUT,
        max_tokens=OUTLINE_MAX_TOKENS,
        temperature=0.7,
    )
    if tokens:
        tokens.add(resp)
    return resp.text


def _build_voice_preservation(
    personality_level: int,
    use_humor: bool,
    use_anecdotes: bool,
    use_rhetorical_questions: bool,
    use_contractions: bool,
    brand_voice_description: str | None,
) -> str:
    """Build voice preservation rubric items for the review step.

    Three tiers based on personality level:
    - 1-3 (neutral): remove stray opinions, only check contractions
    - 4-6 (clear position): protect positions from hedging, check all voice flags
    - 7-10 (opinionated): aggressive preservation of bold/confrontational language
    """
    items: list[str] = []

    if personality_level <= 3:
        # Neutral tier — reviewer should sand DOWN any stray opinions
        items.append(
            "- [ ] Remove any opinionated language, strong claims, or first-person "
            "stances that crept into the draft — keep the tone neutral and objective"
        )
        if not use_contractions:
            items.append(
                "- [ ] Expand all contractions (\"don't\" → \"do not\", "
                "\"can't\" → \"cannot\", etc.)"
            )
    elif personality_level <= 6:
        # Clear position tier — protect positions from being hedged
        items.append(
            "- [ ] Preserve clear positions and direct claims — do NOT weaken them "
            "with hedging phrases like \"it could be argued\" or \"some might say\""
        )
        if use_humor:
            items.append(
                "- [ ] Keep humor intact — do not remove jokes, wit, or playful "
                "asides unless they undermine credibility"
            )
        if use_anecdotes:
            items.append(
                "- [ ] Keep personal anecdotes and stories — do not flatten them "
                "into generic third-person examples"
            )
        if use_rhetorical_questions:
            items.append(
                "- [ ] Keep rhetorical questions — they are intentional engagement "
                "devices, not errors"
            )
        if not use_contractions:
            items.append(
                "- [ ] Expand all contractions (\"don't\" → \"do not\", "
                "\"can't\" → \"cannot\", etc.)"
            )
        if brand_voice_description:
            items.append(
                f"- [ ] Maintain brand voice throughout: {brand_voice_description}"
            )
    else:
        # Opinionated tier (7-10) — aggressive preservation
        items.append(
            "- [ ] PRESERVE all opinionated language, bold claims, and decisive "
            "statements — the author's strong voice is intentional, not an error"
        )
        items.append(
            "- [ ] Do NOT soften confrontational or provocative phrasing. "
            "Example of what NOT to do:\n"
            "    DRAFT: \"Most agencies are lying to your face about ROI.\"\n"
            "    BAD REVIEW: \"Some agencies may not fully disclose ROI metrics.\"\n"
            "    GOOD REVIEW: Keep the original — the directness is the point."
        )
        if use_humor:
            items.append(
                "- [ ] Keep all humor, sarcasm, and irreverent asides — they are "
                "core to the voice, not optional decoration"
            )
        if use_anecdotes:
            items.append(
                "- [ ] Keep personal anecdotes in first person — do not rewrite "
                "them as detached third-person observations"
            )
        if use_rhetorical_questions:
            items.append(
                "- [ ] Keep rhetorical questions — they drive the argumentative rhythm"
            )
        if not use_contractions:
            items.append(
                "- [ ] Expand all contractions (\"don't\" → \"do not\", "
                "\"can't\" → \"cannot\", etc.)"
            )
        if brand_voice_description:
            items.append(
                f"- [ ] Maintain brand voice throughout: {brand_voice_description}"
            )

    return "\n".join(items)


async def _generate_review(
    system_prompt: str,
    draft: str,
    outline: str,
    personality_level: int = 5,
    use_humor: bool = False,
    use_anecdotes: bool = False,
    use_rhetorical_questions: bool = False,
    use_contractions: bool = True,
    brand_voice_description: str | None = None,
    tokens: TokenAccumulator | None = None,
) -> str:
    """Step 3 of article chain: review and polish the draft using rubric."""
    voice_instructions = _build_voice_preservation(
        personality_level=personality_level,
        use_humor=use_humor,
        use_anecdotes=use_anecdotes,
        use_rhetorical_questions=use_rhetorical_questions,
        use_contractions=use_contractions,
        brand_voice_description=brand_voice_description,
    )

    user_prompt = (
        "Review and revise the article below using the rubric. "
        "Output ONLY the revised article in markdown — no commentary, no rubric scores.\n\n"
        "## Original Outline (for structural compliance)\n"
        "<outline>\n"
        f"{outline}\n"
        "</outline>\n\n"
        "## Review Rubric\n\n"
        "### Priority 1 — Structural Compliance (fix first)\n"
        "- [ ] Section order matches outline\n"
        "- [ ] Each H2 opens with a 40-60 word answer statement (inverted pyramid)\n"
        "- [ ] Per-section word budgets met (within ~15%)\n"
        "- [ ] Data markers present per outline\n"
        "- [ ] Conclusion = one specific actionable next step, not a summary\n\n"
        "### Priority 2 — Anti-Robot Quality (fix second)\n"
        "- [ ] Zero banned phrases remain\n"
        "- [ ] No two consecutive paragraphs start the same way\n"
        "- [ ] Sentence length varies (mix short <8 words with long 20+ words)\n"
        "- [ ] Active voice throughout\n"
        "- [ ] Conversational transition hooks between sections\n\n"
        "### Priority 3 — Polish & Voice (fix last)\n"
        "- [ ] Intro hooks with a specific claim or number in the first two sentences\n"
        "- [ ] Paragraphs 2-4 sentences max\n"
        "- [ ] Self-contained knowledge blocks (GEO)\n"
        f"{voice_instructions}\n\n"
        "## Article Draft\n"
        f"{draft}"
    )
    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=REVIEW_TIMEOUT,
        max_tokens=REVIEW_MAX_TOKENS,
        temperature=0.2,
    )
    if tokens:
        tokens.add(resp)
    return resp.text


def _parse_seo_meta(raw: str, title: str, excerpt: str, has_image: bool) -> SeoMetaResult:
    """Parse the AI response for SEO metadata fields.

    Handles various formats: section headers, numbered lists, label: value pairs.
    Falls back gracefully on parse failure.
    """
    meta_title = None
    meta_description = None
    image_alt_text = None

    current_field = None
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue

        upper = line.upper()
        # Detect field headers
        if "META_TITLE" in upper or "META TITLE" in upper:
            current_field = "title"
            # Check if value is on the same line after a colon
            if ":" in line:
                val = line.split(":", 1)[1].strip().strip('"\'')
                if val:
                    meta_title = val
            continue
        elif "META_DESCRIPTION" in upper or "META DESCRIPTION" in upper:
            current_field = "desc"
            if ":" in line:
                val = line.split(":", 1)[1].strip().strip('"\'')
                if val:
                    meta_description = val
            continue
        elif "IMAGE_ALT_TEXT" in upper or "IMAGE ALT TEXT" in upper or "ALT_TEXT" in upper or "ALT TEXT" in upper:
            current_field = "alt"
            if ":" in line:
                val = line.split(":", 1)[1].strip().strip('"\'')
                if val:
                    image_alt_text = val
            continue

        # Strip leading numbering: "1.", "1)", etc.
        cleaned = re.sub(r"^\d+[\.\)\:\-]\s*", "", line).strip().strip('"\'')
        if not cleaned:
            continue

        # If we're under a field header and haven't captured the value yet
        if current_field == "title" and not meta_title:
            meta_title = cleaned
        elif current_field == "desc" and not meta_description:
            meta_description = cleaned
        elif current_field == "alt" and not image_alt_text:
            image_alt_text = cleaned

    # Fallbacks
    if not meta_title:
        meta_title = title[:200] if title else "Untitled"
    if not meta_description:
        meta_description = excerpt[:500] if excerpt else ""
    if has_image and not image_alt_text:
        image_alt_text = None  # will be None — non-fatal

    return SeoMetaResult(
        meta_title=meta_title,
        meta_description=meta_description,
        image_alt_text=image_alt_text,
    )


async def _generate_seo_meta(
    title: str,
    excerpt: str,
    industry: str | None = None,
    focus_keyword: str | None = None,
    image_source: str | None = None,
    tokens: TokenAccumulator | None = None,
) -> SeoMetaResult:
    """Generate SEO meta title, meta description, and image alt text."""
    has_image = image_source and image_source != "none"

    system_prompt = (
        "You are an SEO metadata specialist optimizing for both traditional search "
        "engines and AI answer engines (Google SGE, Perplexity, ChatGPT search) "
        "using 2026 best practices."
    )

    keyword_line = ""
    if focus_keyword:
        keyword_line = f"\nPrimary keyword: \"{focus_keyword}\"\n"

    industry_line = ""
    if industry:
        industry_line = f"\nIndustry context: {industry}\n"

    alt_text_section = ""
    if has_image:
        alt_text_section = (
            "\n3. IMAGE_ALT_TEXT (~100-125 characters)\n"
            "   - Descriptive, keyword-relevant\n"
            "   - Do NOT start with \"Image of\" or \"Photo of\"\n"
            "   - Describe what the image would show for this article topic\n"
        )

    user_prompt = (
        f"Generate SEO metadata for an article titled: \"{title}\"\n\n"
        f"Article excerpt: \"{excerpt}\"\n"
        f"{keyword_line}{industry_line}\n"
        "Return EXACTLY these fields, each on its own labeled line:\n\n"
        "1. META_TITLE (50-60 characters, hard max 78)\n"
        "   - Entity-rich \"Who + What + Context\" pattern\n"
        "   - Power words or numbers where natural\n"
        "   - Thematically aligned with the H1 but NOT identical\n"
        "   - Primary keyword near front, conversational flow over exact-match\n\n"
        "2. META_DESCRIPTION (140-160 characters total)\n"
        "   - First ~120 chars: Atomic answer — direct factual statement AI engines can cite\n"
        "   - Last ~40 chars: Value tease requiring click-through\n"
        "   - Must match the page's core entity and intent\n"
        "   - No generic CTAs (\"Discover\", \"Learn how\", \"Find out\")\n"
        f"{alt_text_section}\n"
        "Format:\n"
        "META_TITLE: your title here\n"
        "META_DESCRIPTION: your description here\n"
        + ("IMAGE_ALT_TEXT: your alt text here\n" if has_image else "")
    )

    try:
        resp = await _call_openai(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            timeout=META_TIMEOUT,
            max_tokens=META_MAX_TOKENS,
            temperature=0.4,
        )
        if tokens:
            tokens.add(resp)
        return _parse_seo_meta(resp.text, title, excerpt, has_image)
    except Exception as e:
        logger.warning("SEO meta generation failed (non-fatal): %s", e)
        return SeoMetaResult(
            meta_title=title[:200],
            meta_description=excerpt[:500] if excerpt else "",
            image_alt_text=None,
        )


async def generate_content(
    template: PromptTemplate,
    title: str,
    word_count: int | None = None,
    tone: str | None = None,
    replacements: dict[str, str] | None = None,
    experience_context: str | None = None,
    progress_callback=None,
    image_source: str | None = None,
    image_style_guidance: str | None = None,
    industry: str | None = None,
) -> ContentResult:
    """3-step article chain: Outline → Draft → Review/Polish, plus optional image.

    Args:
        progress_callback: Optional async callable(stage, step, total, message).
            Called before each pipeline stage to report progress.
        image_source: "dalle", "unsplash", or None/"none" to skip.
        image_style_guidance: Optional style hint for DALL-E (ignored for Unsplash).
        industry: Template industry, used for image prompt context.
    """
    system_prompt = build_content_system_prompt(template, experience_context)

    effective_word_count = word_count or template.default_word_count
    effective_tone = tone or template.default_tone

    has_image = image_source and image_source != "none"
    total_steps = 5 if has_image else 4

    # Token accumulator for the entire content pipeline
    acc = TokenAccumulator()

    # Build the content prompt from structured fields
    content_prompt = (
        f"Write a {effective_word_count}-word article titled: {title}\n\n"
        f"Tone: {effective_tone}"
    )

    # Step 1: Outline
    if progress_callback:
        await progress_callback("outline", 1, total_steps, "Building article outline...")
    outline = await _generate_outline(system_prompt, title, effective_word_count, tokens=acc)

    # Step 2: Draft (content prompt + outline with word budgets)
    if progress_callback:
        await progress_callback("draft", 2, total_steps, "Writing first draft...")
    draft_prompt = (
        f"{content_prompt}\n\n"
        "Follow this outline strictly, including the word budget for EACH section. "
        f"Write at least {effective_word_count} words total.\n\n"
        f"{outline}"
    )
    draft_resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=draft_prompt,
        timeout=DRAFT_TIMEOUT,
        max_tokens=DRAFT_MAX_TOKENS,
    )
    acc.add(draft_resp)
    draft = _strip_code_fences(draft_resp.text)

    # Step 3: Review/Polish
    if progress_callback:
        await progress_callback("review", 3, total_steps, "Reviewing and polishing...")
    polished = await _generate_review(
        system_prompt=system_prompt,
        draft=draft,
        outline=outline,
        personality_level=template.personality_level or 5,
        use_humor=template.use_humor or False,
        use_anecdotes=template.use_anecdotes or False,
        use_rhetorical_questions=template.use_rhetorical_questions or False,
        use_contractions=template.use_contractions if template.use_contractions is not None else True,
        brand_voice_description=template.brand_voice_description,
        tokens=acc,
    )
    polished = _strip_code_fences(polished)

    html = markdown_to_html(polished)
    excerpt = extract_excerpt(html)

    # Step 4: SEO metadata
    if progress_callback:
        await progress_callback("meta", 4, total_steps, "Generating SEO metadata...")
    seo_meta = await _generate_seo_meta(
        title=title,
        excerpt=excerpt,
        industry=industry or template.industry,
        focus_keyword=template.seo_focus_keyword,
        image_source=image_source,
        tokens=acc,
    )

    # Step 5: Featured image (optional)
    featured_image_url = None
    if has_image:
        if progress_callback:
            await progress_callback("image", 5, total_steps, "Generating featured image...")
        from app.services.images import generate_featured_image
        featured_image_url = await generate_featured_image(
            source=image_source,
            title=title,
            industry=industry,
            style_guidance=image_style_guidance,
        )

    return ContentResult(
        content_markdown=polished,
        content_html=html,
        excerpt=excerpt,
        system_prompt_used=system_prompt,
        content_prompt_used=content_prompt,
        outline_used=outline,
        featured_image_url=featured_image_url,
        meta_title=seo_meta.meta_title,
        meta_description=seo_meta.meta_description,
        image_alt_text=seo_meta.image_alt_text,
        prompt_tokens=acc.prompt_tokens,
        completion_tokens=acc.completion_tokens,
        total_tokens=acc.total_tokens,
    )


# --- HTML → Markdown conversion ---


def html_to_markdown(html: str) -> str:
    """Convert HTML content back to markdown for AI revision."""
    return md(html, heading_style="ATX", bullets="-", strip=["img"]).strip()


# --- Revision pipeline (2-step: revise + polish) ---


async def _generate_revision_polish(
    system_prompt: str,
    revised_markdown: str,
    personality_level: int = 5,
    use_humor: bool = False,
    use_anecdotes: bool = False,
    use_rhetorical_questions: bool = False,
    use_contractions: bool = True,
    brand_voice_description: str | None = None,
    tokens: TokenAccumulator | None = None,
) -> str:
    """Lighter polish pass for revisions — anti-robot + voice only, no structural rubric."""
    voice_instructions = _build_voice_preservation(
        personality_level=personality_level,
        use_humor=use_humor,
        use_anecdotes=use_anecdotes,
        use_rhetorical_questions=use_rhetorical_questions,
        use_contractions=use_contractions,
        brand_voice_description=brand_voice_description,
    )

    user_prompt = (
        "Polish the revised article below. "
        "Output ONLY the polished article in markdown — no commentary.\n\n"
        "## Quality Checklist\n"
        "- [ ] Zero banned phrases remain\n"
        "- [ ] No two consecutive paragraphs start the same way\n"
        "- [ ] Sentence length varies (mix short <8 words with long 20+ words)\n"
        "- [ ] Active voice throughout\n"
        "- [ ] Paragraphs 2-4 sentences max\n\n"
        "## Voice Preservation\n"
        f"{voice_instructions}\n\n"
        "## Article\n"
        f"{revised_markdown}"
    )
    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=REVISION_TIMEOUT,
        max_tokens=REVISION_MAX_TOKENS,
        temperature=0.2,
    )
    if tokens:
        tokens.add(resp)
    return resp.text


async def revise_content(
    content_html: str,
    feedback: str,
    system_prompt: str,
    template: "PromptTemplate | None" = None,
    progress_callback=None,
) -> RevisionResult:
    """2-step revision pipeline: Revise (apply feedback) → Polish (quality pass).

    Args:
        content_html: Current post HTML content.
        feedback: Natural-language revision instructions from the user.
        system_prompt: The system prompt to use (preserves original context).
        template: Optional template for voice settings. If None, polish step is skipped.
        progress_callback: Optional async callable(stage, step, total, message).
    """
    total_steps = 2 if template else 1
    current_markdown = html_to_markdown(content_html)
    acc = TokenAccumulator()

    # Step 1: Revise — apply user feedback
    if progress_callback:
        await progress_callback("revise", 1, total_steps, "Applying your feedback...")

    revision_prompt = (
        "Revise the article below based on the editor's feedback. "
        "Preserve everything that works — only change what the feedback asks for. "
        "Output ONLY the revised article in markdown — no commentary, "
        "no acknowledgment of the feedback.\n\n"
        f"## Editor's Feedback\n{feedback}\n\n"
        f"## Current Article\n{current_markdown}"
    )
    revised_resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=revision_prompt,
        timeout=REVISION_TIMEOUT,
        max_tokens=REVISION_MAX_TOKENS,
        temperature=0.4,
    )
    acc.add(revised_resp)
    revised = _strip_code_fences(revised_resp.text)

    # Step 2: Polish — lighter quality pass (skipped if template deleted)
    if template:
        if progress_callback:
            await progress_callback("polish", 2, total_steps, "Polishing revised content...")
        polished = await _generate_revision_polish(
            system_prompt=system_prompt,
            revised_markdown=revised,
            personality_level=template.personality_level or 5,
            use_humor=template.use_humor or False,
            use_anecdotes=template.use_anecdotes or False,
            use_rhetorical_questions=template.use_rhetorical_questions or False,
            use_contractions=template.use_contractions if template.use_contractions is not None else True,
            brand_voice_description=template.brand_voice_description,
            tokens=acc,
        )
        polished = _strip_code_fences(polished)
    else:
        polished = revised

    html = markdown_to_html(polished)
    excerpt = extract_excerpt(html)

    return RevisionResult(
        content_markdown=polished,
        content_html=html,
        excerpt=excerpt,
        revision_prompt_used=feedback,
        prompt_tokens=acc.prompt_tokens,
        completion_tokens=acc.completion_tokens,
        total_tokens=acc.total_tokens,
    )


# --- Full pipeline (used by scheduler) ---


async def generate_post(
    template: PromptTemplate,
    topic: str,
    word_count: int | None = None,
    tone: str | None = None,
    replacements: dict[str, str] | None = None,
    experience_context: str | None = None,
    existing_titles: list[str] | None = None,
) -> GenerationResult:
    """Full pipeline: generate 5 titles, pick by style weighting, then 3-step article chain."""
    title_result = await generate_titles(template, topic, replacements, existing_titles=existing_titles)

    # Pick title based on headline style
    style = resolve_content_type(template.content_type)
    if style == "ai_selected":
        # Weighted random: how-to 25%, contrarian 5%, listicle 35%, experience 20%, direct benefit 15%
        idx = random.choices(range(min(5, len(title_result.titles))), weights=AI_SELECTED_WEIGHTS[:len(title_result.titles)], k=1)[0]
    else:
        # All 5 are the same type — pick any randomly
        idx = random.randrange(len(title_result.titles))
    selected_title = title_result.titles[idx]

    # Fall back to template-level experience notes if no explicit context
    effective_experience = experience_context if experience_context is not None else template.experience_notes

    content_result = await generate_content(
        template, selected_title, word_count, tone, replacements,
        experience_context=effective_experience,
        image_source=template.image_source,
        image_style_guidance=template.image_style_guidance,
        industry=template.industry,
    )

    return GenerationResult(
        title=selected_title,
        titles_generated=title_result.titles,
        content_markdown=content_result.content_markdown,
        content_html=content_result.content_html,
        excerpt=content_result.excerpt,
        system_prompt_used=content_result.system_prompt_used,
        topic_prompt_used=title_result.topic_prompt_used,
        content_prompt_used=content_result.content_prompt_used,
        outline_used=content_result.outline_used,
        featured_image_url=content_result.featured_image_url,
        meta_title=content_result.meta_title,
        meta_description=content_result.meta_description,
        image_alt_text=content_result.image_alt_text,
        prompt_tokens=title_result.prompt_tokens + content_result.prompt_tokens,
        completion_tokens=title_result.completion_tokens + content_result.completion_tokens,
        total_tokens=title_result.total_tokens + content_result.total_tokens,
    )
