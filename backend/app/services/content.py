"""Optimized AI content generation pipeline.

Title stage: Generate 5 headline variants (How-To, Contrarian, Listicle, Experience, Direct Benefit)
Article stage: 3-step chain (Outline → Draft → Review/Polish)

Uses OpenAI GPT-4o for all stages. Designed to be called by
the scheduler (generate_post) or individually via test endpoints.
"""

import asyncio
import json
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
CHART_TIMEOUT = 30
CHART_MAX_TOKENS = 1500
LINKEDIN_TIMEOUT = 30
LINKEDIN_MAX_TOKENS = 500
FAQ_SCHEMA_TIMEOUT = 30
FAQ_SCHEMA_MAX_TOKENS = 1500

# --- Cost calculation (GPT-4o pricing as of 2026) ---
GPT4O_INPUT_COST = 2.50 / 1_000_000    # $2.50 per 1M input tokens
GPT4O_OUTPUT_COST = 10.00 / 1_000_000   # $10.00 per 1M output tokens
DALLE3_COST = 0.04                       # per standard image
DALLE3_HD_COST = 0.08                    # per HD image
WEB_SEARCH_COST = 0.03                   # per Responses API web_search call (medium context)

# Web research constants
RESEARCH_TIMEOUT = 45
RESEARCH_MAX_TOKENS = 2000

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
BANNED_ACADEMIC_FILLER = [
    "provide a valuable insight", "left an indelible mark", "a stark reminder",
    "a nuanced understanding", "significant role in shaping",
    "the complex interplay", "broad implication", "an unwavering commitment",
    "endure a legacy", "underscore the importance", "play a pivotal role",
    "a pivotal moment", "navigate the complex", "mark a turning point",
    "continue to inspire", "gain a deeper understanding",
    "the transformative power", "hold a significant", "play a crucial role",
    "particularly a concern", "the relentless pursuit", "emphasize the need",
    "target an intervention", "a multi-faceted approach", "a serf reminder",
    "highlight the potential", "a significant milestone",
    "implication to understand", "potential risk associated",
    "leave a lasting", "add a layer", "offer a valuable",
    "a profound implication", "case highlights the importance",
    "finding a highlight of the importance", "pave the way for the future",
    "a significant step forward", "face a significant",
    "finding an important implication", "emphasize the importance",
    "a significant implication", "delve deeper into", "reply in tone",
    "raise an important question",
    "make an informed decision in regard to", "far-reaching implications",
    "a comprehensive framework", "importance to consider", "a unique blend",
    "couldn't help but wonder", "underscore the need",
    "framework for understanding", "highlight the need",
    "a comprehensive understanding", "the journey begins",
    "understanding the fundamental", "despite the face",
    "a delicate balance", "the path ahead", "gain an insight",
    "laid the groundwork", "understand the behavior", "renew a sense",
    "aim to explore", "present a unique challenge", "provide a comprehensive",
    "particularly with regard to", "address the root cause",
    "loom large in", "the implication of the finding",
    "approach ensures a", "an ongoing dialogue", "carry a weight",
    "ability to navigate", "present a significant", "study shed light on",
    "a diverse perspective", "face an adversity", "a comprehensive overview",
    "potentially lead to", "a broad understanding",
    "contribute to the understanding", "shape the public",
    "particularly noteworthy", "the evidence base for decision making",
    "identify an area of improvement",
    "analysis of the data to analyze and use", "undergone a significant",
    "need a robust", "voice will fill", "concern a potential",
    "initiative aims to", "offering a unique", "a new avenue",
    "despite the challenge", "ready to embrace", "the societal expectation",
    "make accessible", "today at a fast pace", "stand in stark contrast",
]
BANNED_PHRASES = (
    BANNED_TRANSITIONS + BANNED_AI_ISMS + BANNED_HEDGING
    + BANNED_JOURNEY_POWER + BANNED_OVERUSED_ADJECTIVES + BANNED_CLICHES
    + BANNED_ACADEMIC_FILLER
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
    faq_schema: str | None = None
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
    faq_schema: str | None = None
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

    # --- Entity Injection (always-on semantic SEO / GEO) ---
    entity_injection = (
        "## Entity Injection\n"
        "Identify 3-5 real-world entities (people, organizations, places, concepts, "
        "events, or technologies) that are central to the topic.\n"
        "For each entity, go beyond name-dropping — state its relationship to the "
        "topic explicitly so AI models can categorize the content:\n"
        "- Declare taxonomic relationships: 'X is a type of Y', 'X falls under the "
        "category of Y'\n"
        "- State roles and associations: 'X was developed by Y', 'X is the governing "
        "body for Y'\n"
        "- Define cause/effect or purpose: 'X is used for Y', 'X solves the problem "
        "of Y'\n"
        "Establish a clear entity hierarchy: identify the PRIMARY entity (the article's "
        "core subject) and 2-4 SUPPORTING entities that provide context, contrast, or "
        "evidence. The primary entity should appear in the introduction, TL;DR, and "
        "conclusion. Supporting entities should cluster in the sections where they add "
        "the most value.\n"
        "Write at least one clear definitional sentence for the primary entity early "
        "in the article — a single sentence an AI could extract as a knowledge-graph "
        "triple (Subject → Predicate → Object)."
    )
    sections.append(entity_injection)

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
        "and keep paragraphs to 2-4 sentences max.\n"
        "TL;DR block: Immediately after the opening paragraph, include a blockquote "
        "starting with **TL;DR:** that summarizes the article's core answer in 2-3 "
        "sentences. Be specific and direct — this is the snippet search engines and "
        "AI models will extract as THE answer. Do not use vague teasers.\n"
        "Key Takeaway blocks: Include 1-2 blockquote callouts in the article that "
        "distill a critical insight into 1-2 punchy sentences. Format them as "
        "markdown blockquotes starting with **Key Takeaway:** — e.g. "
        '"> **Key Takeaway:** The most effective approach is X because Y." '
        "Place them after the supporting evidence, not before. These concise "
        "snippets are prime targets for featured snippets and AI answer extraction.\n"
        "Quotable definitions: For every major concept introduced, write one crisp "
        "definitional sentence that an AI could cite verbatim — e.g. "
        "'Content pruning is the practice of removing or consolidating underperforming "
        "pages to strengthen a site's topical authority.' Place these near the first "
        "mention of the concept, not buried in a paragraph.\n"
        "Comparison tables: When comparing 3 or more alternatives, options, tools, or "
        "approaches, present them in a markdown table with clear column headers rather "
        "than prose. Tables are highly extractable by AI answer engines and improve "
        "scannability.\n"
        "Question-headed sections: Phrase every H2 as a natural question that a real "
        "person would type into a search bar or ask an AI assistant — e.g. "
        "'How Much Does X Cost in 2026?' not 'Pricing Overview'. The answer-first "
        "paragraph directly below should be a standalone answer to that exact question.\n"
        "Freshness signals: Weave 1-2 temporal references into the article where "
        "factually appropriate — e.g. 'As of 2026', 'In Q1 2026', 'Current best "
        "practice as of early 2026'. Place at least one in the TL;DR or introduction. "
        "Do NOT fabricate dates for undated information — only attach dates to facts "
        "you are confident are current."
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


# --- Web Research (Responses API with web_search tool) ---


async def _call_openai_responses(
    instructions: str,
    user_input: str,
    model: str = MODEL,
    timeout: int = RESEARCH_TIMEOUT,
    max_tokens: int = RESEARCH_MAX_TOKENS,
    max_retries: int = MAX_RETRIES,
    temperature: float = 0.4,
) -> tuple[OpenAIResponse, list[dict]]:
    """Call OpenAI Responses API with web_search tool.

    Returns (OpenAIResponse, citations) where citations is a list of
    {"url": str, "title": str} dicts, deduped by URL.
    """
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout)

    for attempt in range(max_retries + 1):
        try:
            response = await client.responses.create(
                model=model,
                instructions=instructions,
                input=user_input,
                tools=[{"type": "web_search", "search_context_size": "medium"}],
                max_output_tokens=max_tokens,
                temperature=temperature,
            )

            # Extract text using the output_text convenience property
            text = response.output_text or ""

            # Extract citations from annotations (url_citation type), deduped by URL
            seen_urls: set[str] = set()
            citations: list[dict] = []
            for item in response.output:
                if hasattr(item, "content"):
                    for content_block in item.content:
                        if hasattr(content_block, "annotations"):
                            for ann in content_block.annotations:
                                if ann.type == "url_citation" and ann.url not in seen_urls:
                                    seen_urls.add(ann.url)
                                    citations.append({"url": ann.url, "title": ann.title or ""})

            # Map Responses API usage fields to our OpenAIResponse dataclass
            usage = response.usage
            return OpenAIResponse(
                text=text.strip(),
                prompt_tokens=usage.input_tokens if usage else 0,
                completion_tokens=usage.output_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            ), citations

        except (APIConnectionError, APITimeoutError, RateLimitError) as e:
            if attempt == max_retries:
                raise
            wait = 2**attempt
            logger.warning(
                "OpenAI Responses API transient error (attempt %d/%d): %s. Retrying in %ds...",
                attempt + 1, max_retries + 1, e, wait,
            )
            await asyncio.sleep(wait)


async def _generate_web_research(
    title: str,
    industry: str | None = None,
    tokens: TokenAccumulator | None = None,
) -> tuple[str, list[dict]] | None:
    """Search the web for 3-5 current statistics/facts relevant to the article topic.

    Returns (research_text, citations) or None on failure (non-fatal).
    """
    industry_hint = f" in the {industry} industry" if industry else ""

    instructions = (
        "You are a research assistant. Your job is to find 3-5 current, "
        "specific statistics, data points, or expert findings that would "
        "strengthen a blog article. Focus on recent data (2024-2026). "
        "For each finding, include the exact number/stat and a one-sentence "
        "context. Do NOT fabricate or estimate numbers — only report what "
        "you find from real sources."
    )

    user_input = (
        f"Find 3-5 recent statistics, data points, or research findings relevant to "
        f"an article titled: \"{title}\"{industry_hint}.\n\n"
        "Return them as a numbered list. For each item:\n"
        "- State the specific statistic or finding\n"
        "- Include the source name and year\n"
        "- Add one sentence of context on why it matters\n\n"
        "Focus on: percentages, dollar amounts, growth rates, survey results, "
        "or expert quotes. Prefer authoritative sources (industry reports, "
        "government data, major publications)."
    )

    try:
        resp, citations = await _call_openai_responses(
            instructions=instructions,
            user_input=user_input,
        )
        if tokens:
            tokens.add(resp)
        if not resp.text:
            return None
        return resp.text, citations
    except Exception as e:
        logger.warning("Web research failed (non-fatal): %s", e)
        return None


def _format_sources_section(citations: list[dict]) -> str:
    """Format citations into a markdown Sources section."""
    if not citations:
        return ""
    lines = ["## Sources\n"]
    for cit in citations:
        title = cit.get("title", "").strip()
        url = cit.get("url", "").strip()
        if url:
            display = title if title else url
            lines.append(f"- [{display}]({url})")
    return "\n".join(lines)


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
    research_context: str | None = None,
) -> str:
    """Step 1 of article chain: generate a structured outline."""
    # Reserve ~250 words for intro + conclusion, split rest across sections
    body_budget = word_count - 250
    user_prompt = (
        f"Create a detailed outline for a {word_count}-word article titled '{title}'.\n\n"
        "## Structure\n"
        "- Introduction (~125 words): Hook + thesis statement\n"
        "- 3-5 H2 sections (main body): Each H2 must be phrased as a natural question "
        "a real person would type into Google or ask an AI assistant — e.g. "
        "'How Much Does Solar Panel Installation Cost?' not 'Solar Panel Pricing'\n"
        "- Conclusion (~125 words): One specific, actionable next step — NOT a summary\n\n"
        "## For Each H2 Section, Provide:\n"
        "1. **Header** as a natural-language question readers would actually search for\n"
        f"2. **Word budget** — distribute ~{body_budget} words across all sections "
        "(state the budget for each, e.g. '~350 words')\n"
        "3. **Answer statement** (40-60 words) — the direct answer that will OPEN "
        "the section before any supporting detail (inverted pyramid). This must work "
        "as a standalone answer if extracted by an AI search engine.\n"
        "4. **Key points** (2-3) — supporting evidence, examples, or sub-arguments\n"
        "5. **Data marker** — one place where a statistic, number, or citation "
        "would strengthen credibility\n"
        "6. **Transition hook** — one sentence showing how this section connects "
        "to the next (use conversational connectors, not 'Moreover' or 'Furthermore')\n"
        "7. **Related question (H3)** — for at least 2 of the H2 sections, include one "
        "H3 subheading phrased as a follow-up question readers would also ask (the kind "
        "that appears in Google's 'People Also Ask' or AI follow-up suggestions). "
        "E.g. under 'How Much Does X Cost?' add an H3 like 'Is X Worth the Investment "
        "in 2026?' Each related-question H3 should have its own 2-3 sentence answer.\n\n"
    )
    if research_context:
        user_prompt += (
            "<research>\n"
            f"{research_context}\n"
            "</research>\n\n"
            "Incorporate the 2-3 most relevant findings from the research above "
            "into the Data Marker slots of your outline. Cite specific numbers.\n\n"
        )
    user_prompt += "Return ONLY the outline in the format above."
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
        "- [ ] Conclusion = one specific actionable next step, not a summary\n"
        "- [ ] Preserve all <div> HTML blocks (charts/tables) exactly as-is — do NOT modify, rewrite, or remove them\n\n"
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


# --- Data Visualization (chart extraction + rendering) ---


def _render_bar_chart(chart: dict) -> str:
    """Render a horizontal or vertical bar chart as pure inline-CSS HTML."""
    title = chart.get("title", "")
    subtitle = chart.get("subtitle", "")
    items = chart.get("items", [])
    orientation = chart.get("orientation", "horizontal")

    if not items:
        return ""

    # Find max value for percentage scaling
    max_val = max(abs(float(item.get("value", 0))) for item in items)
    if max_val == 0:
        max_val = 1

    title_html = f'<div style="font-family:Inter,sans-serif;font-size:16px;font-weight:700;color:#2D5E4A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">{title}</div>' if title else ""
    subtitle_html = f'<div style="font-family:Inter,sans-serif;font-size:13px;color:#8A8478;margin-bottom:16px;">{subtitle}</div>' if subtitle else ""
    source_text = chart.get("source_text", "")
    source_html = f'<div style="font-family:Inter,sans-serif;font-size:11px;color:#8A8478;margin-top:12px;font-style:italic;">Source context: {source_text}</div>' if source_text else ""

    if orientation == "vertical":
        # Vertical bars — flex row of columns
        bar_cols = []
        for item in items:
            val = float(item.get("value", 0))
            unit = item.get("unit", "")
            label = item.get("label", "")
            pct = (abs(val) / max_val) * 100
            height_pct = max(pct, 5)  # min 5% height for visibility
            bar_cols.append(
                f'<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:60px;">'
                f'<div style="font-family:Inter,sans-serif;font-size:12px;font-weight:600;color:#B08D57;margin-bottom:4px;">{val}{unit}</div>'
                f'<div style="width:70%;height:{height_pct}px;max-height:120px;min-height:8px;background-color:#4A7C6F;"></div>'
                f'<div style="font-family:Inter,sans-serif;font-size:11px;color:#555;margin-top:6px;text-align:center;">{label}</div>'
                f'</div>'
            )
        # Recalculate heights as pixel values proportional to max
        bar_cols_px = []
        for item in items:
            val = float(item.get("value", 0))
            unit = item.get("unit", "")
            label = item.get("label", "")
            pct = (abs(val) / max_val)
            height_px = max(int(pct * 120), 8)
            bar_cols_px.append(
                f'<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:60px;justify-content:flex-end;">'
                f'<div style="font-family:Inter,sans-serif;font-size:12px;font-weight:600;color:#B08D57;margin-bottom:4px;">{val}{unit}</div>'
                f'<div style="width:70%;height:{height_px}px;background-color:#4A7C6F;"></div>'
                f'<div style="font-family:Inter,sans-serif;font-size:11px;color:#555;margin-top:6px;text-align:center;">{label}</div>'
                f'</div>'
            )
        bars_html = f'<div style="display:flex;align-items:flex-end;gap:8px;min-height:160px;">{"".join(bar_cols_px)}</div>'
    else:
        # Horizontal bars — stacked rows (default)
        rows = []
        for item in items:
            val = float(item.get("value", 0))
            unit = item.get("unit", "")
            label = item.get("label", "")
            pct = (abs(val) / max_val) * 100
            width_pct = max(pct, 3)  # min 3% width for visibility
            rows.append(
                f'<div style="display:flex;align-items:center;margin-bottom:8px;">'
                f'<div style="font-family:Inter,sans-serif;font-size:12px;color:#555;width:120px;flex-shrink:0;text-align:right;padding-right:12px;">{label}</div>'
                f'<div style="flex:1;background-color:#E0DCD5;height:24px;position:relative;">'
                f'<div style="background-color:#4A7C6F;height:100%;width:{width_pct:.1f}%;"></div>'
                f'</div>'
                f'<div style="font-family:Inter,sans-serif;font-size:12px;font-weight:600;color:#B08D57;width:70px;text-align:right;padding-left:8px;">{val}{unit}</div>'
                f'</div>'
            )
        bars_html = "".join(rows)

    return (
        f'<div style="background-color:#FAF8F5;border:1px solid #E0DCD5;border-left:4px solid #B08D57;'
        f'padding:20px;margin:24px 0;font-family:Inter,sans-serif;">'
        f'{title_html}{subtitle_html}{bars_html}{source_html}'
        f'</div>'
    )


def _render_table(chart: dict) -> str:
    """Render a styled HTML table with zebra striping and optional highlight column."""
    title = chart.get("title", "")
    columns = chart.get("columns", [])
    rows = chart.get("rows", [])
    highlight_column = chart.get("highlight_column")

    if not columns or not rows:
        return ""

    title_html = f'<div style="font-family:Inter,sans-serif;font-size:16px;font-weight:700;color:#2D5E4A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">{title}</div>' if title else ""
    source_text = chart.get("source_text", "")
    source_html = f'<div style="font-family:Inter,sans-serif;font-size:11px;color:#8A8478;margin-top:8px;font-style:italic;">Source context: {source_text}</div>' if source_text else ""

    # Header row
    header_cells = []
    for col in columns:
        is_highlight = (col == highlight_column)
        bg = "background-color:#4A7C6F;color:#fff;" if is_highlight else "background-color:#2D5E4A;color:#fff;"
        header_cells.append(
            f'<th style="{bg}font-family:Inter,sans-serif;font-size:12px;font-weight:700;'
            f'text-transform:uppercase;letter-spacing:0.5px;padding:10px 14px;text-align:left;">{col}</th>'
        )
    header_row = f'<tr>{"".join(header_cells)}</tr>'

    # Data rows with zebra striping
    data_rows = []
    for i, row in enumerate(rows):
        bg_color = "#FAF8F5" if i % 2 == 0 else "#F0EDE8"
        cells = []
        for j, col in enumerate(columns):
            cell_val = row[j] if j < len(row) else ""
            is_highlight = (col == highlight_column)
            cell_bg = f"background-color:{'#E8F0EC' if i % 2 == 0 else '#DCE8E2'};" if is_highlight else f"background-color:{bg_color};"
            font_weight = "font-weight:600;" if is_highlight else ""
            cells.append(
                f'<td style="{cell_bg}{font_weight}font-family:Inter,sans-serif;font-size:13px;'
                f'color:#333;padding:9px 14px;border-bottom:1px solid #E0DCD5;">{cell_val}</td>'
            )
        data_rows.append(f'<tr>{"".join(cells)}</tr>')

    table_html = (
        f'<table style="width:100%;border-collapse:collapse;border:1px solid #E0DCD5;">'
        f'<thead>{header_row}</thead>'
        f'<tbody>{"".join(data_rows)}</tbody>'
        f'</table>'
    )

    return (
        f'<div style="background-color:#FAF8F5;border:1px solid #E0DCD5;border-left:4px solid #B08D57;'
        f'padding:20px;margin:24px 0;font-family:Inter,sans-serif;overflow-x:auto;">'
        f'{title_html}{table_html}{source_html}'
        f'</div>'
    )


def _render_chart_html(chart: dict) -> str | None:
    """Dispatch to the correct renderer based on chart type."""
    chart_type = chart.get("type", "")
    if chart_type == "bar_chart":
        return _render_bar_chart(chart)
    elif chart_type == "table":
        return _render_table(chart)
    return None


async def _extract_chart_data(
    draft: str,
    industry: str | None = None,
    tokens: TokenAccumulator | None = None,
) -> list[dict] | None:
    """Scan draft for chartable data and return 0-2 structured chart specs.

    Returns None on any failure (non-fatal). AI never invents data —
    it only extracts statistics already present in the article text.
    """
    system_prompt = (
        "You are a data visualization analyst. Your job is to scan article drafts "
        "and identify statistics, comparisons, rankings, or percentage breakdowns "
        "that would benefit from a visual chart or table.\n\n"
        "Rules:\n"
        "- Return a JSON array with 0-2 chart specifications\n"
        "- Only extract data that is ALREADY in the article — NEVER invent numbers\n"
        "- Skip single isolated statistics (need at least 2 comparable data points)\n"
        "- Prefer: comparisons, rankings, progressions, percentage breakdowns\n"
        "- Return an empty array [] if nothing is worth visualizing\n"
        "- Return ONLY valid JSON — no markdown fences, no commentary"
    )

    industry_hint = f"\nArticle industry: {industry}" if industry else ""

    user_prompt = (
        f"Scan this article draft for chartable data.{industry_hint}\n\n"
        "For each chart, return one of these JSON schemas:\n\n"
        "Bar chart:\n"
        '{"type": "bar_chart", "orientation": "horizontal"|"vertical", '
        '"title": "short chart title", "subtitle": "optional context line", '
        '"items": [{"label": "item name", "value": number, "unit": "%"|"x"|"$"|""}], '
        '"source_text": "sentence from the article this data came from", '
        '"insert_after_heading": "H2 heading text where this chart belongs"}\n\n'
        "Table:\n"
        '{"type": "table", "title": "short table title", '
        '"columns": ["Col1", "Col2", ...], '
        '"rows": [["val1", "val2", ...], ...], '
        '"highlight_column": "column name to emphasize" or null, '
        '"source_text": "sentence from the article this data came from", '
        '"insert_after_heading": "H2 heading text where this table belongs"}\n\n'
        f"ARTICLE DRAFT:\n\n{draft}"
    )

    try:
        resp = await _call_openai(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            timeout=CHART_TIMEOUT,
            max_tokens=CHART_MAX_TOKENS,
            temperature=0.3,
        )
        if tokens:
            tokens.add(resp)

        raw = _strip_code_fences(resp.text).strip()
        charts = json.loads(raw)

        if not isinstance(charts, list):
            logger.warning("Chart extraction returned non-list: %s", type(charts))
            return None

        # Hard cap at 2 charts
        charts = charts[:2]

        # Validate each spec
        valid = []
        for chart in charts:
            if not isinstance(chart, dict):
                continue
            ctype = chart.get("type", "")
            if ctype == "bar_chart":
                items = chart.get("items", [])
                if isinstance(items, list) and len(items) >= 2:
                    valid.append(chart)
            elif ctype == "table":
                rows = chart.get("rows", [])
                cols = chart.get("columns", [])
                if isinstance(rows, list) and len(rows) >= 2 and isinstance(cols, list) and len(cols) >= 2:
                    valid.append(chart)

        return valid if valid else None

    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Chart extraction JSON parse failed (non-fatal): %s", e)
        return None
    except Exception as e:
        logger.warning("Chart extraction failed (non-fatal): %s", e)
        return None


def _inject_charts_into_draft(
    draft_markdown: str,
    charts: list[dict],
    rendered_htmls: list[str],
) -> str:
    """Insert rendered chart HTML blocks into the markdown draft.

    For each chart, finds the H2 heading matching `insert_after_heading`
    (case-insensitive partial match) and inserts the HTML block after the
    first paragraph under that heading. Processes in reverse document order
    to avoid index shifting. Falls back to appending at end if heading not found.
    """
    lines = draft_markdown.split("\n")

    # Build insertion plan: list of (line_index, html) — insert AFTER line_index
    insertions: list[tuple[int, str]] = []

    for chart, html in zip(charts, rendered_htmls):
        target_heading = (chart.get("insert_after_heading") or "").lower().strip()
        if not target_heading:
            # No heading specified — append at end
            insertions.append((len(lines) - 1, html))
            continue

        found = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Match H2 headings: "## Something"
            if stripped.startswith("## "):
                heading_text = stripped.lstrip("#").strip().lower()
                if target_heading in heading_text or heading_text in target_heading:
                    # Found the heading — find end of first paragraph after it
                    # Skip blank lines after heading
                    j = i + 1
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    # Now find the end of the first paragraph (next blank line or next heading)
                    while j < len(lines) and lines[j].strip() and not lines[j].strip().startswith("#"):
                        j += 1
                    # Insert after the paragraph (at position j)
                    insertions.append((j, html))
                    found = True
                    break

        if not found:
            # Fallback: append at end
            insertions.append((len(lines), html))

    # Sort by position descending so inserts don't shift earlier indices
    insertions.sort(key=lambda x: x[0], reverse=True)

    for pos, html in insertions:
        # Insert as a raw HTML block (blank-line delimited for markdown)
        html_block = f"\n{html}\n"
        lines.insert(pos, html_block)

    return "\n".join(lines)


# --- FAQ Schema Generation ---


async def _extract_faq_pairs(
    article_text: str,
    title: str,
    industry: str | None = None,
    tokens: TokenAccumulator | None = None,
) -> list[dict] | None:
    """Extract 3-5 Q&A pairs from the finished article for FAQPage JSON-LD.

    Returns None on any failure (non-fatal). AI never invents information —
    it only extracts questions and answers from content already in the article.
    """
    system_prompt = (
        "You are an SEO structured data specialist. Extract 3-5 question-and-answer "
        "pairs from the article that would make good FAQ rich results.\n\n"
        "Rules:\n"
        "- Questions must be real questions a searcher would type (natural language, "
        "not article headings verbatim)\n"
        "- Answers must be concise (1-3 sentences), factual, drawn directly from the article\n"
        "- Return a JSON array: [{\"question\": \"...\", \"answer\": \"...\"}, ...]\n"
        "- Return empty array [] if article has no FAQ-worthy content\n"
        "- NEVER invent information not in the article\n"
        "- Return ONLY valid JSON — no markdown fences, no commentary"
    )

    industry_hint = f"\nArticle industry: {industry}" if industry else ""

    user_prompt = (
        f"Extract FAQ pairs from this article titled \"{title}\".{industry_hint}\n\n"
        f"ARTICLE:\n\n{article_text}"
    )

    try:
        resp = await _call_openai(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            timeout=FAQ_SCHEMA_TIMEOUT,
            max_tokens=FAQ_SCHEMA_MAX_TOKENS,
            temperature=0.3,
        )
        if tokens:
            tokens.add(resp)

        raw = _strip_code_fences(resp.text).strip()
        pairs = json.loads(raw)

        if not isinstance(pairs, list):
            logger.warning("FAQ extraction returned non-list: %s", type(pairs))
            return None

        # Validate structure and cap at 5 pairs
        valid = []
        for pair in pairs[:5]:
            if (
                isinstance(pair, dict)
                and isinstance(pair.get("question"), str)
                and isinstance(pair.get("answer"), str)
                and pair["question"].strip()
                and pair["answer"].strip()
            ):
                valid.append({
                    "question": pair["question"].strip(),
                    "answer": pair["answer"].strip(),
                })

        return valid if valid else None

    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("FAQ extraction JSON parse failed (non-fatal): %s", e)
        return None
    except Exception as e:
        logger.warning("FAQ extraction failed (non-fatal): %s", e)
        return None


def _build_faq_schema_json(pairs: list[dict]) -> str:
    """Build a Schema.org FAQPage JSON-LD script tag from Q&A pairs."""
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": pair["question"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": pair["answer"],
                },
            }
            for pair in pairs
        ],
    }
    json_str = json.dumps(schema, ensure_ascii=False, indent=2)
    # Safety: escape any </script> in answer text to prevent XSS
    json_str = json_str.replace("</script>", "<\\/script>")
    return f'<script type="application/ld+json">\n{json_str}\n</script>'


def _inject_faq_schema(html: str, schema_script: str) -> str:
    """Append FAQ schema JSON-LD script tag at the end of HTML content."""
    return html + "\n" + schema_script


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
    dalle_quality: str = "standard",
    web_research_enabled: bool = False,
) -> ContentResult:
    """Pipeline: [Research] → Outline → Draft → Charts → Review → FAQ Schema → Meta → [Image].

    Args:
        progress_callback: Optional async callable(stage, step, total, message,
            **extra_fields). Called before each pipeline stage to report progress.
        image_source: "dalle", "unsplash", or None/"none" to skip.
        image_style_guidance: Optional style hint for DALL-E (ignored for Unsplash).
        industry: Template industry, used for image prompt context.
        dalle_quality: "standard" ($0.04) or "hd" ($0.08) — tier-dependent.
        web_research_enabled: If True, run web research before outline.
    """
    system_prompt = build_content_system_prompt(template, experience_context)

    effective_word_count = word_count or template.default_word_count
    effective_tone = tone or template.default_tone

    has_image = image_source and image_source != "none"
    has_research = web_research_enabled

    # Dynamic step counting: 6 base + optional research + optional image
    total_steps = 6 + (1 if has_research else 0) + (1 if has_image else 0)
    step = 0  # running counter, incremented before each stage

    # Token accumulator for the entire content pipeline
    acc = TokenAccumulator()

    # Build the content prompt from structured fields
    content_prompt = (
        f"Write a {effective_word_count}-word article titled: {title}\n\n"
        f"Tone: {effective_tone}"
    )

    # Optional Step: Web Research
    research_text = None
    research_citations: list[dict] = []
    if has_research:
        step += 1
        if progress_callback:
            await progress_callback(
                "research", step, total_steps, "Researching current data...",
                has_research=True, has_image=has_image,
            )
        result = await _generate_web_research(
            title=title,
            industry=industry or template.industry,
            tokens=acc,
        )
        if result:
            research_text, research_citations = result
            logger.info("Web research found %d citations", len(research_citations))

    # Step: Outline
    step += 1
    if progress_callback:
        await progress_callback(
            "outline", step, total_steps, "Building article outline...",
            has_research=has_research, has_image=has_image,
        )
    outline = await _generate_outline(
        system_prompt, title, effective_word_count,
        tokens=acc, research_context=research_text,
    )

    # Step: Draft (content prompt + outline with word budgets)
    step += 1
    if progress_callback:
        await progress_callback(
            "draft", step, total_steps, "Writing first draft...",
            has_research=has_research, has_image=has_image,
        )
    draft_prompt = (
        f"{content_prompt}\n\n"
        "Follow this outline strictly, including the word budget for EACH section. "
        f"Write at least {effective_word_count} words total.\n\n"
        f"{outline}"
    )
    if research_text:
        draft_prompt += (
            "\n\n<research>\n"
            f"{research_text}\n"
            "</research>\n\n"
            "Weave the most relevant research findings naturally into the article. "
            "For every statistic or factual claim drawn from the research, include an "
            "inline citation immediately after the claim using the format: "
            "(Source: Organization Name, Year) — e.g. '...grew by 34% year-over-year "
            "(Source: Gartner, 2025).' This makes claims individually citable by AI "
            "search engines. Do not cluster all citations at the end of a paragraph."
        )
    draft_resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=draft_prompt,
        timeout=DRAFT_TIMEOUT,
        max_tokens=DRAFT_MAX_TOKENS,
    )
    acc.add(draft_resp)
    draft = _strip_code_fences(draft_resp.text)

    # Step: Charts — scan for chartable data and inject visualizations (non-fatal)
    step += 1
    if progress_callback:
        await progress_callback(
            "charts", step, total_steps, "Scanning for chartable data...",
            has_research=has_research, has_image=has_image,
        )
    try:
        chart_specs = await _extract_chart_data(
            draft=draft,
            industry=industry or template.industry,
            tokens=acc,
        )
        if chart_specs:
            rendered = [_render_chart_html(c) for c in chart_specs]
            # Filter out None (unknown chart types)
            pairs = [(spec, html) for spec, html in zip(chart_specs, rendered) if html]
            if pairs:
                valid_specs, valid_htmls = zip(*pairs)
                draft = _inject_charts_into_draft(draft, list(valid_specs), list(valid_htmls))
                logger.info("Injected %d chart(s) into draft", len(valid_htmls))
    except Exception as e:
        logger.warning("Chart step failed (non-fatal), continuing without charts: %s", e)

    # Step: Review/Polish
    step += 1
    if progress_callback:
        await progress_callback(
            "review", step, total_steps, "Reviewing and polishing...",
            has_research=has_research, has_image=has_image,
        )
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

    # Append Sources section if web research produced citations
    if research_citations:
        sources_md = _format_sources_section(research_citations)
        if sources_md:
            polished = polished.rstrip() + "\n\n" + sources_md

    html = markdown_to_html(polished)
    excerpt = extract_excerpt(html)

    # Step: FAQ Schema (non-fatal)
    faq_schema_script = None
    step += 1
    if progress_callback:
        await progress_callback(
            "faq_schema", step, total_steps, "Generating FAQ schema...",
            has_research=has_research, has_image=has_image,
        )
    try:
        faq_pairs = await _extract_faq_pairs(
            article_text=polished,
            title=title,
            industry=industry or template.industry,
            tokens=acc,
        )
        if faq_pairs:
            faq_schema_script = _build_faq_schema_json(faq_pairs)
            html = _inject_faq_schema(html, faq_schema_script)
            logger.info("Injected FAQ schema with %d Q&A pairs", len(faq_pairs))
    except Exception as e:
        logger.warning("FAQ schema generation failed (non-fatal): %s", e)

    # Step: SEO metadata
    step += 1
    if progress_callback:
        await progress_callback(
            "meta", step, total_steps, "Generating SEO metadata...",
            has_research=has_research, has_image=has_image,
        )
    seo_meta = await _generate_seo_meta(
        title=title,
        excerpt=excerpt,
        industry=industry or template.industry,
        focus_keyword=template.seo_focus_keyword,
        image_source=image_source,
        tokens=acc,
    )

    # Optional Step: Featured image
    featured_image_url = None
    if has_image:
        step += 1
        if progress_callback:
            await progress_callback(
                "image", step, total_steps, "Generating featured image...",
                has_research=has_research, has_image=has_image,
            )
        from app.services.images import generate_featured_image
        featured_image_url = await generate_featured_image(
            source=image_source,
            title=title,
            industry=industry,
            style_guidance=image_style_guidance,
            quality=dalle_quality,
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
        faq_schema=faq_schema_script,
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
    dalle_quality: str = "standard",
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
        dalle_quality=dalle_quality,
        web_research_enabled=bool(template.web_research_enabled),
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
        faq_schema=content_result.faq_schema,
        prompt_tokens=title_result.prompt_tokens + content_result.prompt_tokens,
        completion_tokens=title_result.completion_tokens + content_result.completion_tokens,
        total_tokens=title_result.total_tokens + content_result.total_tokens,
    )


# ---------------------------------------------------------------------------
# LinkedIn repurpose
# ---------------------------------------------------------------------------

# LinkedIn algorithm intelligence — injected into every LinkedIn prompt.
# Structured as a single block so it's easy to update as the platform evolves.
LINKEDIN_PLATFORM_INTELLIGENCE = (
    "## LinkedIn Algorithm Intelligence\n"
    "Internalize the following platform rules. They are non-negotiable.\n\n"

    "### Dwell Time (Primary Ranking Signal)\n"
    "LinkedIn measures how long readers stay on your post. Longer dwell = more reach.\n"
    "- Plant an OPEN LOOP in the first 3 lines: tease a result, a number, or a "
    "lesson learned — but withhold the payoff until the body. The reader must scroll "
    "to close the loop.\n"
    "- Use PATTERN INTERRUPTS every 3-4 lines: a one-word sentence, a surprising "
    "pivot ('But here is what nobody talks about.'), or a mid-post contradiction "
    "that resets attention.\n"
    "- Place the most valuable insight at ~60-70% through the post, not at the top. "
    "Front-loading the payoff lets readers leave early.\n\n"

    "### Comment Velocity (5-10x Weight vs. Likes)\n"
    "Comments are the highest-value engagement signal. The algorithm amplifies posts "
    "that generate conversation, especially in the first 60 minutes.\n"
    "- Embed one DEBATABLE OPINION or lightly polarizing take mid-post — something "
    "reasonable people would disagree on. This is not clickbait; it is a genuine "
    "professional stance that invites counter-perspectives.\n"
    "- End with a SPECIFIC open-ended question that asks peers to share their own "
    "experience, approach, or contrarian view. Never a yes/no question. Never "
    "'What do you think?' — too generic. Instead: 'What is the one metric your "
    "team stopped tracking that actually improved performance?'\n"
    "- Avoid engagement-bait phrases: 'Like if you agree', 'Share this with your "
    "network', 'Tag someone who needs this', 'Comment YES below'. LinkedIn's "
    "algorithm actively penalizes these patterns and may classify the post as spam.\n\n"

    "### Text Post Format Signals\n"
    "For text-only posts (no document/carousel), the algorithm rewards:\n"
    "- CHARACTER COUNT: 1,200-1,500 characters. Under 800 gets minimal distribution. "
    "Over 2,000 gets penalized for low completion rate.\n"
    "- LINE BREAK DENSITY: 8-12 blank-line paragraph breaks. This creates the visual "
    "rhythm of short paragraphs that keeps mobile readers scrolling. A wall of text "
    "with only 2-3 breaks gets scroll-past on mobile (where ~70% of LinkedIn "
    "consumption happens).\n"
    "- 1-3 sentences per paragraph MAX. Single-sentence paragraphs are not just "
    "acceptable — they are the norm for high-performing LinkedIn posts.\n\n"

    "### Content Categorization & Topical Routing\n"
    "LinkedIn's algorithm classifies every post into a content category and routes "
    "it to users interested in that topic. Help the algorithm by:\n"
    "- Placing a CLEAR TOPICAL SIGNAL in the first 2 lines. If the post is about "
    "hiring strategy, say 'hiring' or 'recruiting' in the hook — not in line 8.\n"
    "- Using 2-3 hashtags at the very end that match LinkedIn's known topic "
    "categories (e.g. #Leadership, #Marketing, #AI, #Sales). Niche hashtags with "
    "<500 followers get no algorithmic boost.\n\n"

    "### Native Expertise Signals\n"
    "LinkedIn deprioritizes content that feels repurposed from another platform. "
    "The post MUST feel like it was written on LinkedIn, for LinkedIn.\n"
    "- Open with 'I' or a first-person observation. Never open with a thesis "
    "statement or a definition — that reads as a blog excerpt.\n"
    "- Reference professional context: 'a conversation with my team', 'something "
    "I noticed in our Q4 results', 'a pattern I keep seeing in my industry'. "
    "These signal lived experience.\n"
    "- NEVER reference the original blog post, 'my latest article', or 'link in "
    "comments'. External links incur a 20-30% reach penalty and signal content "
    "that exists to drive traffic away from LinkedIn.\n\n"

    "### Reach Killers (Avoid These)\n"
    "- Editing the post within 1 hour of publishing tanks its momentum (the "
    "algorithm resets distribution).\n"
    "- Posting and immediately commenting on your own post to 'boost' it — "
    "LinkedIn detects and penalizes this.\n"
    "- Multiple outbound links (even in comments) within the first hour.\n"
    "- Identical content posted across platforms — LinkedIn's algorithm detects "
    "cross-posted content and deprioritizes it.\n"
    "- Excessive emoji use (>3) or emoji-heavy formatting (emoji bullets, emoji "
    "headers) — correlated with lower professional trust scores.\n"
)


# Industries where AI-style text is tolerated or even performs well.
_LINKEDIN_AI_FRIENDLY = {
    "leadership", "management", "coaching", "motivation", "inspiration",
    "personal development", "self-help", "hr", "human resources",
}

# Industries where AI-style text gets heavily penalized by audiences.
_LINKEDIN_AI_HOSTILE = {
    "marketing", "branding", "advertising", "content marketing",
    "strategy", "consulting", "innovation",
    "healthcare", "medicine", "medical", "pharma", "pharmaceutical",
    "legal", "law", "finance", "accounting",
}


def _linkedin_tone_for_industry(industry: str | None) -> str:
    """Return an industry-calibrated tone section for the LinkedIn prompt."""
    if not industry:
        return ""

    industry_lower = industry.lower().strip()

    # Check AI-friendly industries
    for keyword in _LINKEDIN_AI_FRIENDLY:
        if keyword in industry_lower:
            return (
                "## Tone Calibration\n"
                f"Industry: {industry}. This audience responds well to polished, "
                "aspirational content. You may use a confident, motivational tone. "
                "Keep it genuine, but an uplifting register is appropriate here.\n\n"
            )

    # Check AI-hostile industries
    for keyword in _LINKEDIN_AI_HOSTILE:
        if keyword in industry_lower:
            return (
                "## Tone Calibration\n"
                f"Industry: {industry}. WARNING: This audience has extremely high "
                "AI literacy and will immediately disengage from anything that reads "
                "as generic or automated. You MUST:\n"
                "- Pull specific numbers, names, or examples directly from the article. "
                "Do not generalize.\n"
                "- Write like a practitioner sharing a hard-won lesson, not a thought "
                "leader broadcasting wisdom.\n"
                "- Include at least one concrete detail (a metric, a tool name, a "
                "real scenario) that could not have been written without reading "
                "the original article.\n"
                "- Prefer understated confidence over enthusiasm.\n\n"
            )

    # Default: moderate guidance
    return (
        "## Tone Calibration\n"
        f"Industry: {industry}. Write with the authority of someone who works "
        "in this field daily. Ground claims in specifics from the article.\n\n"
    )


def _build_linkedin_voice_section(template) -> str:
    """Build a voice/style section for the LinkedIn prompt from template fields.

    Mirrors the blog pipeline's Voice & Style logic but adapted for LinkedIn's
    short-form format. Only emitted when the template has voice data.
    """
    voice: list[str] = []

    # Perspective — override the default "first person" if template says otherwise
    if template.perspective and template.perspective in PERSPECTIVE_MAP:
        perspective_instruction = PERSPECTIVE_MAP[template.perspective]
        voice.append(perspective_instruction)

    # Brand voice description
    if template.brand_voice_description:
        voice.append(f"Brand voice: {template.brand_voice_description}")

    # Personality / assertiveness level
    pl = template.personality_level
    if pl is not None:
        if pl >= 7:
            voice.append(
                "Be opinionated and take strong stances. No hedging or "
                "\"some might argue\" equivocation."
            )
        elif pl >= 4:
            voice.append(
                "Take a clear position. Avoid wishy-washy phrasing like "
                "\"it depends\" or \"some might say.\""
            )
        # 1-3: neutral — no extra instruction (LinkedIn default is already
        # professional-conversational, which works for neutral voices)

    # Tone — override the hardcoded "professional but conversational"
    if template.default_tone and template.default_tone.lower() != "informative":
        voice.append(f"Tone: {template.default_tone}.")

    # Stylistic switches
    if template.use_anecdotes:
        voice.append("Weave in a brief personal anecdote if the article provides one.")
    if template.use_rhetorical_questions:
        voice.append("Use a rhetorical question where it strengthens the narrative.")
    if template.use_humor:
        voice.append("Incorporate wit or dry humor where natural.")
    if template.use_contractions is False:
        voice.append(
            "Do NOT use contractions (write \"do not\" instead of \"don't\", etc.)."
        )

    if not voice:
        return ""

    return "## Author Voice\n" + "\n".join(f"- {v}" for v in voice) + "\n\n"


def _build_linkedin_banned_list(template) -> str:
    """Merge hardcoded BANNED_PHRASES with the template's phrases_to_avoid."""
    all_banned = list(BANNED_PHRASES)
    if template and template.phrases_to_avoid:
        hardcoded_lower = {p.lower() for p in BANNED_PHRASES}
        for phrase in template.phrases_to_avoid:
            if phrase.lower() not in hardcoded_lower:
                all_banned.append(phrase)
    return ", ".join(f'"{p}"' for p in all_banned)


async def repurpose_to_linkedin(
    content_html: str,
    title: str,
    industry: str | None = None,
    template=None,
) -> str:
    """Convert a blog post into a LinkedIn post (~1300 chars).

    Uses markdownify to strip HTML, then a single GPT call to rewrite
    the key points as a LinkedIn-native post. Voice is injected from the
    template when available; tone is calibrated based on industry.
    """
    # Convert HTML → plain-ish text for the prompt
    plain_text = md(content_html, heading_style="ATX", strip=["img"])
    # Truncate if extremely long to stay within prompt budget
    if len(plain_text) > 6000:
        plain_text = plain_text[:6000] + "\n…[truncated]"

    # Merge user's phrases_to_avoid with hardcoded BANNED_PHRASES
    banned_list = _build_linkedin_banned_list(template)

    # Industry-aware tone calibration.
    tone_section = _linkedin_tone_for_industry(industry)

    # Voice/style from template's "Match My Writing Style" fields
    voice_section = _build_linkedin_voice_section(template) if template else ""

    # Preferred terms from template
    preferred_line = ""
    if template and template.preferred_terms:
        terms = ", ".join(template.preferred_terms)
        preferred_line = f"\n- ALWAYS use these preferred terms: {terms}\n"

    # Determine perspective instruction for the base rules.
    # If template specifies a non-first-person perspective, we skip the
    # hardcoded "Write in first person" line and let the voice section handle it.
    has_custom_perspective = (
        template
        and template.perspective
        and template.perspective in PERSPECTIVE_MAP
        and "first_person" not in template.perspective
    )
    perspective_line = (
        "- Write in the perspective specified in the Author Voice section below.\n"
        if has_custom_perspective
        else "- Write in first person. Professional but conversational, not corporate.\n"
    )

    # Determine contraction instruction — skip if voice section overrides it
    has_no_contractions = template and template.use_contractions is False
    contraction_line = (
        ""
        if has_no_contractions
        else "Use contractions (you're, it's, we've, don't). "
    )

    system_prompt = (
        "You are a LinkedIn ghostwriter who deeply understands the platform's "
        "algorithm and unspoken rules. Convert the blog article below into a "
        "LinkedIn post that the algorithm will actively distribute.\n\n"

        # --- Platform intelligence (algorithm rules) ---
        f"{LINKEDIN_PLATFORM_INTELLIGENCE}\n"

        # --- Post structure ---
        "## Post Structure\n"
        "Follow this arc exactly:\n"
        "- HOOK (first line, under 150 characters): LinkedIn truncates at ~150 "
        "chars with a 'See more' button. Your opening line's ONLY job is to earn "
        "that click. Use a contrarian take, an unexpected stat, a personal 'I' "
        "observation, or a specific pain point. The hook MUST contain a clear "
        "topical signal so the algorithm can categorize the post.\n"
        "- STORY (body): Blend 2-3 key insights from the article with a clear "
        "narrative thread. Use the Problem > Insight > Action arc. Plant one open "
        "loop in the first 3 lines. Include one debatable professional opinion "
        "that invites disagreement.\n"
        "- PAYOFF (ending): Resolve the hook's tension. Close with a specific "
        "open-ended question that asks peers to share their experience or "
        "contrarian view. Never a yes/no question. Never 'What do you think?'\n\n"

        # --- Writing rules ---
        "## Writing Rules\n"
        "- ~1,300 characters (hard max 1,500). No markdown formatting.\n"
        f"{perspective_line}"
        "- SENTENCE DYNAMICS: Deliberately vary sentence length. Mix short punchy "
        "fragments (3-6 words) with longer descriptive sentences. Identical "
        "sentence lengths are the #1 marker of AI text.\n"
        f"- Use active voice exclusively. {contraction_line}"
        "Minimize adverbs. Replace them with stronger, specific verbs.\n"
        "- Do NOT summarize. Distill. Pick the most valuable takeaway and lead "
        "with it.\n"
        "- Never use em dashes. Use periods, commas, or colons instead.\n"
        f"{preferred_line}\n"

        # --- Voice & tone sections (template-specific) ---
        f"{voice_section}"
        f"{tone_section}"

        # --- Banned phrases ---
        "## Banned Phrases\n"
        "NEVER use any of the following words or phrases. They are immediate "
        "markers of AI-generated content and will destroy reader trust:\n"
        f"{banned_list}"
    )

    user_prompt = f"Blog title: {title}\n\nFull article:\n{plain_text}"

    resp = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        timeout=LINKEDIN_TIMEOUT,
        max_tokens=LINKEDIN_MAX_TOKENS,
        temperature=0.7,
    )
    return resp.text
