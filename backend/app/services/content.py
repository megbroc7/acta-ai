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
INTERVIEW_TIMEOUT = 30
INTERVIEW_MAX_TOKENS = 800
MAX_RETRIES = 2
MARKDOWN_EXTENSIONS = ["extra", "codehilite", "toc", "nl2br"]

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
    "### BAD — Generic AI opening\n"
    "In today's rapidly evolving digital landscape, businesses are increasingly "
    "leveraging content marketing to harness the power of organic reach. It is "
    "important to note that a robust content strategy encompasses multiple facets "
    "of audience engagement.\n\n"
    "### GOOD — Answer-first, specific\n"
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


# --- Return types ---


@dataclass
class TitleResult:
    titles: list[str]
    title_system_prompt_used: str
    topic_prompt_used: str


@dataclass
class ContentResult:
    content_markdown: str
    content_html: str
    excerpt: str
    system_prompt_used: str
    content_prompt_used: str
    outline_used: str


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
            f"\nPrimary keyword to incorporate near the front of titles: "
            f'"{template.seo_focus_keyword}"'
        )

    header = (
        "You are a Senior SEO Copywriter & Viral Content Strategist.\n"
        f"{industry_line}{keyword_line}\n\n"
        "## Task\n"
        "Generate exactly 5 headline variants for the given topic. "
        "Each title MUST be under 60 characters and place the primary keyword "
        "near the front when one is provided.\n\n"
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
        "Default to active voice. Avoid passive constructions."
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
) -> str:
    """Call OpenAI with retry logic for transient errors."""
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
            return response.choices[0].message.content.strip()
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

    raw = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=topic_prompt,
        timeout=TITLE_TIMEOUT,
        max_tokens=TITLE_MAX_TOKENS,
        temperature=0.8,
    )

    titles = _parse_numbered_titles(raw)
    print(f"[TITLE DEBUG] Parsed {len(titles)} titles: {titles}")

    # Fallback: if parsing yields fewer than 5, pad with what we got
    if not titles:
        print(f"[TITLE DEBUG] WARNING: 0 parsed titles. Raw: {raw[:300]}")
        titles = [clean_title(raw)]
    while len(titles) < 5:
        titles.append(titles[-1])

    return TitleResult(
        titles=titles[:5],
        title_system_prompt_used=system_prompt,
        topic_prompt_used=topic_prompt,
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

    raw = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=INTERVIEW_TIMEOUT,
        max_tokens=INTERVIEW_MAX_TOKENS,
        temperature=0.7,
    )

    questions = _parse_numbered_titles(raw)
    return questions[:5] if questions else [raw.strip()]


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

    raw = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=INTERVIEW_TIMEOUT,
        max_tokens=INTERVIEW_MAX_TOKENS,
        temperature=0.7,
    )

    questions = _parse_numbered_titles(raw)
    return questions[:5] if questions else [raw.strip()]


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
    return await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=OUTLINE_TIMEOUT,
        max_tokens=OUTLINE_MAX_TOKENS,
        temperature=0.7,
    )


async def _generate_review(
    system_prompt: str,
    draft: str,
) -> str:
    """Step 3 of article chain: review and polish the draft."""
    user_prompt = (
        "Review and polish the following article. Ensure: "
        "(1) no banned phrases remain, "
        "(2) answer-first format after every H2, "
        "(3) varied sentence rhythm, "
        "(4) active voice throughout, "
        "(5) conclusion suggests a specific next step rather than summarizing. "
        "Return the complete revised article in markdown, nothing else.\n\n"
        f"{draft}"
    )
    return await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=REVIEW_TIMEOUT,
        max_tokens=REVIEW_MAX_TOKENS,
        temperature=0.2,
    )


async def generate_content(
    template: PromptTemplate,
    title: str,
    word_count: int | None = None,
    tone: str | None = None,
    replacements: dict[str, str] | None = None,
    experience_context: str | None = None,
    progress_callback=None,
) -> ContentResult:
    """3-step article chain: Outline → Draft → Review/Polish.

    Args:
        progress_callback: Optional async callable(stage, step, total, message).
            Called before each pipeline stage to report progress.
    """
    system_prompt = build_content_system_prompt(template, experience_context)

    effective_word_count = word_count or template.default_word_count
    effective_tone = tone or template.default_tone

    # Build the content prompt from structured fields
    content_prompt = (
        f"Write a {effective_word_count}-word article titled: {title}\n\n"
        f"Tone: {effective_tone}"
    )

    # Step 1: Outline
    if progress_callback:
        await progress_callback("outline", 1, 3, "Building article outline...")
    outline = await _generate_outline(system_prompt, title, effective_word_count)

    # Step 2: Draft (content prompt + outline with word budgets)
    if progress_callback:
        await progress_callback("draft", 2, 3, "Writing first draft...")
    draft_prompt = (
        f"{content_prompt}\n\n"
        "Follow this outline strictly, including the word budget for EACH section. "
        f"Write at least {effective_word_count} words total.\n\n"
        f"{outline}"
    )
    draft = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=draft_prompt,
        timeout=DRAFT_TIMEOUT,
        max_tokens=DRAFT_MAX_TOKENS,
    )
    draft = _strip_code_fences(draft)

    # Step 3: Review/Polish
    if progress_callback:
        await progress_callback("review", 3, 3, "Reviewing and polishing...")
    polished = await _generate_review(system_prompt, draft)
    polished = _strip_code_fences(polished)

    html = markdown_to_html(polished)
    excerpt = extract_excerpt(html)

    return ContentResult(
        content_markdown=polished,
        content_html=html,
        excerpt=excerpt,
        system_prompt_used=system_prompt,
        content_prompt_used=content_prompt,
        outline_used=outline,
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
    )
