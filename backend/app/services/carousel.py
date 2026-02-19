"""LinkedIn carousel PDF generation service.

Structures blog content into 5-7 branded slides via one GPT-4o call
with stronger narrative constraints, then renders a downloadable PDF
using Pillow for pixel-perfect rendering with drop shadows and anti-aliased text.
"""

import io
import json
import logging
import math
import os
import random as _random
import re
from dataclasses import dataclass

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from app.services.content import (
    OpenAIResponse,
    _build_linkedin_banned_list,
    _build_linkedin_voice_section,
    _call_openai,
    _linkedin_tone_for_industry,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Font loading (Helvetica via system fonts, cached)
# ---------------------------------------------------------------------------

_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
_font_cache: dict[tuple[bool, int], ImageFont.FreeTypeFont] = {}

_HELVETICA_PATHS = [
    "/System/Library/Fonts/Helvetica.ttc",          # macOS
    "/System/Library/Fonts/HelveticaNeue.ttc",       # macOS alt
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",  # Linux
]


def _get_font(bold: bool = False, size: int = 40) -> ImageFont.FreeTypeFont:
    """Load Helvetica at the requested size with caching."""
    key = (bold, size)
    if key in _font_cache:
        return _font_cache[key]
    font = None
    for path in _HELVETICA_PATHS:
        try:
            font = ImageFont.truetype(path, size=size, index=1 if bold else 0)
            break
        except (OSError, IOError):
            continue
    if font is None:
        inter_path = os.path.join(_FONTS_DIR, "Inter-Variable.ttf")
        try:
            font = ImageFont.truetype(inter_path, size=size)
        except (OSError, IOError):
            font = ImageFont.load_default(size=size)
    _font_cache[key] = font
    return font


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CAROUSEL_TIMEOUT = 60
CAROUSEL_MAX_TOKENS = 3200
MODEL = "gpt-4o"

SLIDE_WIDTH = 1080
SLIDE_HEIGHT = 1350  # portrait — LinkedIn spec

CAROUSEL_MIN_SLIDES = 5
CAROUSEL_MAX_SLIDES = 7
HEADLINE_CHAR_LIMIT = 64
BODY_CHAR_LIMIT = 320
KEY_STAT_CHAR_LIMIT = 24

ALLOWED_SLIDE_TYPES = {"hook", "problem", "insight", "result", "tldr", "cta"}

# ---------------------------------------------------------------------------
# Presets
# ---------------------------------------------------------------------------

CAROUSEL_PRESETS = {
    # ── Original 3 (backwards-compatible) ──────────────────────────────────
    "roman_patina": {
        "primary_color": "#2D4A3E",
        "secondary_color": "#1A3028",
        "text_color": "#FFFFFF",
        "accent_color": "#D4A574",
    },
    "clean_white": {
        "primary_color": "#FFFFFF",
        "secondary_color": "#F5F3F0",
        "text_color": "#2A2520",
        "accent_color": "#4A7C6F",
    },
    "dark_professional": {
        "primary_color": "#1B2838",
        "secondary_color": "#0F1923",
        "text_color": "#FFFFFF",
        "accent_color": "#5BA4B5",
    },
    # ── Dark themes ────────────────────────────────────────────────────────
    "midnight_navy": {
        "primary_color": "#0D1B2A",
        "secondary_color": "#1B263B",
        "text_color": "#E0E1DD",
        "accent_color": "#778DA9",
    },
    "deep_forest": {
        "primary_color": "#1B3A2D",
        "secondary_color": "#0F2419",
        "text_color": "#E8E4DF",
        "accent_color": "#7FB069",
    },
    "charcoal_ember": {
        "primary_color": "#2B2D2F",
        "secondary_color": "#1A1C1E",
        "text_color": "#F0EDEA",
        "accent_color": "#E07A5F",
    },
    "espresso": {
        "primary_color": "#3C2415",
        "secondary_color": "#261509",
        "text_color": "#F5EDE4",
        "accent_color": "#D4A574",
    },
    "obsidian_gold": {
        "primary_color": "#1C1C1C",
        "secondary_color": "#111111",
        "text_color": "#F5F5F0",
        "accent_color": "#C5A055",
    },
    # ── Light themes ───────────────────────────────────────────────────────
    "warm_cream": {
        "primary_color": "#FAF6F0",
        "secondary_color": "#F0E8DA",
        "text_color": "#3A3530",
        "accent_color": "#B08D57",
    },
    "paper_sage": {
        "primary_color": "#F7F7F2",
        "secondary_color": "#ECEEE5",
        "text_color": "#2E3830",
        "accent_color": "#6B8F71",
    },
    "soft_blush": {
        "primary_color": "#FDF6F3",
        "secondary_color": "#F5E6DF",
        "text_color": "#3D2C2E",
        "accent_color": "#C17767",
    },
    "cloud_blue": {
        "primary_color": "#F5F8FC",
        "secondary_color": "#E8EEF5",
        "text_color": "#2A3544",
        "accent_color": "#4A7FB5",
    },
    # ── Cool themes ────────────────────────────────────────────────────────
    "ocean_teal": {
        "primary_color": "#1A4A4A",
        "secondary_color": "#0F3535",
        "text_color": "#E8F0EE",
        "accent_color": "#6EC6B8",
    },
    "slate_blue": {
        "primary_color": "#2E3A4E",
        "secondary_color": "#1E2838",
        "text_color": "#E4E8EC",
        "accent_color": "#7EA8BE",
    },
    "arctic": {
        "primary_color": "#E8EFF5",
        "secondary_color": "#D5E1ED",
        "text_color": "#1A2A3A",
        "accent_color": "#3D7EC7",
    },
    "sage_mist": {
        "primary_color": "#D4DDD5",
        "secondary_color": "#C2CEC4",
        "text_color": "#2A3A2E",
        "accent_color": "#5A7F61",
    },
    # ── Warm themes ────────────────────────────────────────────────────────
    "terracotta": {
        "primary_color": "#5C3A2A",
        "secondary_color": "#3E2518",
        "text_color": "#F5EDE4",
        "accent_color": "#E8A87C",
    },
    "bronze_imperial": {
        "primary_color": "#4A3728",
        "secondary_color": "#32241A",
        "text_color": "#F0E8DF",
        "accent_color": "#C49A6C",
    },
    "burgundy": {
        "primary_color": "#4A1C2A",
        "secondary_color": "#30111A",
        "text_color": "#F5E8EC",
        "accent_color": "#D4758A",
    },
    "sunset_amber": {
        "primary_color": "#F5E6D0",
        "secondary_color": "#EDDCC0",
        "text_color": "#3A2E24",
        "accent_color": "#D48C3C",
    },
    # ── Jewel tones ────────────────────────────────────────────────────────
    "plum_velvet": {
        "primary_color": "#3A1F4A",
        "secondary_color": "#28133A",
        "text_color": "#F0E8F5",
        "accent_color": "#B088C4",
    },
    "emerald": {
        "primary_color": "#1A4A30",
        "secondary_color": "#0F3520",
        "text_color": "#E8F5EE",
        "accent_color": "#50C878",
    },
    "deep_coral": {
        "primary_color": "#5A2030",
        "secondary_color": "#3E1420",
        "text_color": "#F8E8EC",
        "accent_color": "#FF8A80",
    },
    "sapphire": {
        "primary_color": "#1A2A5A",
        "secondary_color": "#101C42",
        "text_color": "#E8ECF8",
        "accent_color": "#6E8CD4",
    },
}

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class CarouselSlide:
    slide_number: int
    slide_type: str  # hook, problem, insight, result, cta
    headline: str
    body_text: str
    key_stat: str | None = None


@dataclass
class CarouselResult:
    pdf_bytes: bytes
    slide_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    image_cost_usd: float = 0.0


# ---------------------------------------------------------------------------
# AI: Structure blog into slides
# ---------------------------------------------------------------------------

SLIDE_SYSTEM_PROMPT_BASE = """You are a LinkedIn carousel content strategist.
Your job is to turn a blog article into a high-retention 5-7 slide carousel that feels written by a real operator, not a generic content bot.

## Output Contract
- Return ONLY a JSON array of slide objects (no markdown, no commentary).
- Each slide object must be:
  {"slide_number": int, "type": str, "headline": str, "body_text": str, "key_stat": str|null}
- Slide type arc must be:
  - Slide 1: "hook"
  - Middle slides: "problem", "insight", and optionally one "result"
  - Penultimate slide: "tldr"
  - Final slide: "cta"

## Creative Constraints
- Think in the style of top LinkedIn carousel creators: clean, specific, easy to skim.
- Choose ONE narrative frame and stay consistent:
  - "Pain -> Mistake -> Fix -> Proof -> TLDR -> Outro"
  - "Cost -> Cause -> Playbook -> Win -> TLDR -> Debate"
  - "Belief -> Breakthrough -> Blueprint -> Outcome -> TLDR -> Question"
- Headlines: max 9 words, high-contrast, specific, no fluff.
- One core idea per slide.
- Middle slides should be short bullet points, not paragraphs.
- Keep each slide concise (roughly 35-55 words max, often less).
- Every slide must create forward tension so the reader wants the next slide.
- At least 2 slides must include concrete details from the source article (number, named tool, named scenario, or specific decision).
- key_stat: only include when supported by the article. Keep it short (examples: "73%", "3x", "$2.4M", "12 days").
- Do NOT fabricate facts or numbers.
- body_text formatting:
  - hook/cta slides: 1-2 short lines, no bullets.
  - problem/insight/result/tldr slides: 2-4 bullets separated by newline and prefixed with "- ".

## Anti-Generic Rules
- Avoid empty claims like "optimize your strategy", "drive impact", "unlock growth."
- Prefer sharp verbs and practitioner language over thought-leader slogans.
- Include one debatable but professional opinion in a middle slide.
- CTA must ask a specific open-ended question peers can answer from real experience.
"""


def _compact_text(value, char_limit: int, preserve_newlines: bool = False) -> str:
    """Normalize whitespace and enforce a conservative character cap."""
    if value is None:
        return ""
    raw = str(value).strip()
    if preserve_newlines:
        lines = [" ".join(line.split()) for line in raw.splitlines()]
        text = "\n".join(line for line in lines if line).strip()
    else:
        text = " ".join(raw.replace("\n", " ").split()).strip()
    if len(text) <= char_limit:
        return text
    return text[:char_limit].rstrip(" ,.;:-")


def _normalize_slide_type(raw_slide_type: str | None) -> str:
    """Normalize model-provided type values to the allowed set."""
    if not raw_slide_type:
        return "insight"
    normalized = re.sub(r"[^a-z]", "", str(raw_slide_type).lower())
    if normalized in ALLOWED_SLIDE_TYPES:
        return normalized
    if "hook" in normalized:
        return "hook"
    if "problem" in normalized or "pain" in normalized:
        return "problem"
    if "result" in normalized or "proof" in normalized or "outcome" in normalized:
        return "result"
    if "tldr" in normalized or "summary" in normalized or "recap" in normalized:
        return "tldr"
    if "cta" in normalized or "question" in normalized or "call" in normalized:
        return "cta"
    return "insight"


def _build_carousel_system_prompt(template=None, industry: str | None = None) -> str:
    """Build a richer system prompt with voice/tone calibration when available."""
    voice_section = _build_linkedin_voice_section(template) if template else ""
    tone_section = _linkedin_tone_for_industry(industry)
    banned_list = _build_linkedin_banned_list(template)

    return (
        f"{SLIDE_SYSTEM_PROMPT_BASE}\n\n"
        f"{voice_section}"
        f"{tone_section}"
        "## Banned Phrases\n"
        "Never use these phrases in any slide headline or body text:\n"
        f"{banned_list}\n"
    )


def _extract_slide_array(raw_text: str) -> list[dict]:
    """Parse JSON from model output with a few defensive fallbacks."""
    text = (raw_text or "").strip()

    # Handle fenced JSON.
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]  # drop opening fence
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]  # drop closing fence
        text = "\n".join(lines).strip()

    # 1) Try direct parse.
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        # 2) Extract likely JSON region.
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1 and end > start:
            payload = json.loads(text[start : end + 1])
        else:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            payload = json.loads(text[start : end + 1])

    if isinstance(payload, dict):
        slides = payload.get("slides")
        if isinstance(slides, list):
            return slides
        raise ValueError("Carousel response JSON did not contain a slide array.")
    if not isinstance(payload, list):
        raise ValueError("Carousel response was not a JSON array.")
    return payload


def _fallback_slides(title: str) -> list[CarouselSlide]:
    """Conservative fallback if model output is malformed."""
    return [
        CarouselSlide(
            slide_number=1,
            slide_type="hook",
            headline=_compact_text(title or "What Most Teams Miss", HEADLINE_CHAR_LIMIT),
            body_text="Most teams solve the visible symptom and miss the hidden constraint.",
            key_stat=None,
        ),
        CarouselSlide(
            slide_number=2,
            slide_type="problem",
            headline="The Cost Of Guesswork",
            body_text="• Teams react to noise, not signal.\n• Priorities shift weekly.\n• Output looks busy, not effective.",
            key_stat=None,
        ),
        CarouselSlide(
            slide_number=3,
            slide_type="insight",
            headline="What Actually Changed",
            body_text="• We defined one decision rule.\n• We aligned around one metric.\n• Work got faster and cleaner.",
            key_stat=None,
        ),
        CarouselSlide(
            slide_number=4,
            slide_type="tldr",
            headline="TL;DR",
            body_text="• Fix the hidden bottleneck first.\n• One metric beats ten dashboards.\n• Speed follows clarity.",
            key_stat=None,
        ),
        CarouselSlide(
            slide_number=5,
            slide_type="cta",
            headline="Your Turn",
            body_text="Which metric or workflow did your team stop using because it created noise?",
            key_stat=None,
        ),
    ]


def _split_sentences(text: str) -> list[str]:
    """Split text into short sentence-like chunks."""
    parts = re.split(r"(?<=[.!?])\s+", text)
    cleaned = [p.strip(" -•\t\r\n") for p in parts if p.strip(" -•\t\r\n")]
    return cleaned


def _normalize_body_for_slide(body_text: str, slide_type: str) -> str:
    """Normalize body style by slide type (bullet-heavy for middle slides)."""
    text = _compact_text(body_text, BODY_CHAR_LIMIT, preserve_newlines=True)
    if not text:
        return ""

    if slide_type in {"problem", "insight", "result", "tldr"}:
        raw_points: list[str] = []
        if "\n" in text:
            raw_points = [ln.strip(" -•\t") for ln in text.splitlines() if ln.strip()]
        else:
            raw_points = re.split(r"\s*[|;]\s*|\s{2,}", text)
            raw_points = [p.strip(" -•\t") for p in raw_points if p.strip(" -•\t")]
            if len(raw_points) <= 1:
                raw_points = _split_sentences(text)

        points: list[str] = []
        for point in raw_points:
            compact = _compact_text(point, 85)
            if compact:
                points.append(compact)
            if len(points) == 4:
                break

        if not points:
            points = [_compact_text(text, 85)]
        return "\n".join(f"• {point}" for point in points[:4] if point)

    # Hook / CTA: keep concise line breaks.
    lines = [ln.strip(" -•\t") for ln in text.splitlines() if ln.strip()]
    if not lines:
        lines = _split_sentences(text)
    return "\n".join(lines[:2]) if lines else text


def _normalize_slides(slides_data: list[dict], title: str) -> list[CarouselSlide]:
    """Normalize model output into a usable 5-7 slide arc."""
    normalized: list[CarouselSlide] = []

    for raw in slides_data[:CAROUSEL_MAX_SLIDES]:
        if not isinstance(raw, dict):
            continue

        headline = _compact_text(raw.get("headline"), HEADLINE_CHAR_LIMIT)
        body_text = _compact_text(raw.get("body_text"), BODY_CHAR_LIMIT, preserve_newlines=True)
        key_stat = _compact_text(raw.get("key_stat"), KEY_STAT_CHAR_LIMIT) or None
        slide_type = _normalize_slide_type(raw.get("type"))

        if not headline and not body_text:
            continue
        if not headline:
            headline = _compact_text(title if not normalized else "Key Insight", HEADLINE_CHAR_LIMIT)
        if not body_text:
            body_text = headline

        normalized.append(
            CarouselSlide(
                slide_number=len(normalized) + 1,
                slide_type=slide_type,
                headline=headline,
                body_text=_normalize_body_for_slide(body_text, slide_type),
                key_stat=key_stat,
            )
        )

    if not normalized:
        return _fallback_slides(title)

    # Pad to minimum with concise insight slides if needed.
    while len(normalized) < CAROUSEL_MIN_SLIDES:
        normalized.append(
            CarouselSlide(
                slide_number=len(normalized) + 1,
                slide_type="insight",
                headline="A Practical Lesson",
                body_text="• Keep one idea per slide.\n• Use specifics, not slogans.\n• Let each slide lead to the next.",
                key_stat=None,
            )
        )

    # Hard cap.
    normalized = normalized[:CAROUSEL_MAX_SLIDES]

    # Enforce the required narrative arc and sequential numbering.
    total = len(normalized)
    result_slot = total - 3 if total >= 6 else 2
    for idx, slide in enumerate(normalized):
        if idx == 0:
            slide.slide_type = "hook"
        elif idx == total - 1:
            slide.slide_type = "cta"
        elif idx == total - 2:
            slide.slide_type = "tldr"
            if not slide.headline:
                slide.headline = "TL;DR"
        elif idx == result_slot and slide.slide_type in {"problem", "insight", "result"}:
            slide.slide_type = "result"
        elif slide.slide_type not in {"problem", "insight", "result"}:
            slide.slide_type = "insight"

        slide.body_text = _normalize_body_for_slide(slide.body_text, slide.slide_type)
        slide.slide_number = idx + 1

    return normalized


async def generate_carousel_slides(
    content_html: str,
    title: str,
    template=None,
    industry: str | None = None,
) -> tuple[list[CarouselSlide], OpenAIResponse]:
    """Call GPT-4o to structure blog content into carousel slides."""
    from markdownify import markdownify

    # Convert HTML to plain text for the AI
    plain_text = markdownify(content_html, strip=["img", "script"]).strip()
    if len(plain_text) > 9000:
        plain_text = plain_text[:9000] + "\n...[truncated]"

    system_prompt = _build_carousel_system_prompt(template, industry=industry)

    user_prompt = f"""Article title: {title}

Article content:
{plain_text}

Structure this into a 5-7 slide LinkedIn carousel.
Return ONLY a JSON array of slide objects."""

    response = await _call_openai(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=MODEL,
        timeout=CAROUSEL_TIMEOUT,
        max_tokens=CAROUSEL_MAX_TOKENS,
        temperature=0.78,
    )

    slides_data = _extract_slide_array(response.text)
    slides = _normalize_slides(slides_data, title)
    return slides, response


# ---------------------------------------------------------------------------
# Branding resolution
# ---------------------------------------------------------------------------


def resolve_branding(template=None, request_branding=None) -> dict:
    """Merge branding from request > template saved config > preset default.

    Returns a complete dict with all color keys + bg_pattern.
    """
    # Start with default preset
    preset_name = "roman_patina"
    result = dict(CAROUSEL_PRESETS["roman_patina"])
    bg_pattern = "none"

    # Layer 1: template saved branding
    if template and template.carousel_branding:
        saved = template.carousel_branding
        saved_preset = saved.get("preset", preset_name)
        if saved_preset in CAROUSEL_PRESETS:
            preset_name = saved_preset
            result = dict(CAROUSEL_PRESETS[saved_preset])
        # Override with any explicit colors from saved config
        for key in ("primary_color", "secondary_color", "text_color", "accent_color"):
            if saved.get(key):
                result[key] = saved[key]
        if saved.get("bg_pattern") in BG_PATTERNS:
            bg_pattern = saved["bg_pattern"]

    # Layer 2: request-level branding override
    if request_branding:
        req = request_branding if isinstance(request_branding, dict) else request_branding.model_dump(exclude_none=True)
        req_preset = req.get("preset")
        if req_preset and req_preset in CAROUSEL_PRESETS:
            preset_name = req_preset
            result = dict(CAROUSEL_PRESETS[req_preset])
        # Override with any explicit colors from request
        for key in ("primary_color", "secondary_color", "text_color", "accent_color"):
            if req.get(key):
                result[key] = req[key]
        if req.get("bg_pattern") in BG_PATTERNS:
            bg_pattern = req["bg_pattern"]

    result["preset"] = preset_name
    result["bg_pattern"] = bg_pattern
    return result


# ---------------------------------------------------------------------------
# Pillow rendering — pixel-perfect with drop shadows & anti-aliased text
# ---------------------------------------------------------------------------


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert '#RRGGBB' to (R, G, B)."""
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _rgba(rgb: tuple[int, int, int], alpha: float) -> tuple[int, int, int, int]:
    """Apply 0.0-1.0 alpha to an RGB tuple."""
    return (rgb[0], rgb[1], rgb[2], int(alpha * 255))


def _contrast_text_rgba(bg_rgb: tuple[int, int, int]) -> tuple[int, int, int, int]:
    """Return near-black or white for best readability on bg_rgb."""
    r, g, b = bg_rgb[0] / 255, bg_rgb[1] / 255, bg_rgb[2] / 255
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return (17, 17, 17, 255) if lum > 0.6 else (255, 255, 255, 255)


def _text_width(font: ImageFont.FreeTypeFont, text: str) -> int:
    """Pixel width of rendered text."""
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0]


# ── drawing primitives ────────────────────────────────────────────────────


def _draw_gradient(img: Image.Image, rgb_top: tuple, rgb_bottom: tuple):
    """Fast vertical gradient fill (line-per-row)."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    r1, g1, b1 = rgb_top
    r2, g2, b2 = rgb_bottom
    for y in range(h):
        t = y / (h - 1) if h > 1 else 0
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        draw.line([(0, y), (w - 1, y)], fill=(r, g, b, 255))


def _draw_card(
    img: Image.Image,
    bbox: tuple[int, int, int, int],
    radius: int = 14,
    fill: tuple = (0, 0, 0, 20),
    outline: tuple | None = None,
    outline_width: int = 2,
    shadow: bool = True,
):
    """Rounded-rect card with optional drop shadow (the Canva look)."""
    x1, y1, x2, y2 = bbox
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle(
            (x1 + 6, y1 + 6, x2 + 6, y2 + 6),
            radius=radius, fill=(0, 0, 0, 38),
        )
        sh = sh.filter(ImageFilter.GaussianBlur(radius=14))
        img.alpha_composite(sh)

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(bbox, radius=radius, fill=fill,
                        outline=outline, width=outline_width)
    img.alpha_composite(layer)


# ── text utilities ────────────────────────────────────────────────────────


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    if not text or not text.strip():
        return []
    lines: list[str] = []
    paragraphs = text.split("\n")
    for p_idx, paragraph in enumerate(paragraphs):
        paragraph = paragraph.strip()
        if not paragraph:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        words = paragraph.split()
        current = ""
        for word in words:
            test = f"{current} {word}".strip() if current else word
            if _text_width(font, test) <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        if p_idx < len(paragraphs) - 1 and lines and lines[-1] != "":
            lines.append("")
    while lines and lines[-1] == "":
        lines.pop()
    return lines


def _draw_text(
    img: Image.Image,
    lines: list[str],
    x: int, y: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple,
    align: str = "left",
    line_height: int | None = None,
    max_lines: int = 99,
    area_width: int = 0,
):
    """Draw text lines with alignment support."""
    draw = ImageDraw.Draw(img)
    if line_height is None:
        line_height = int(font.size * 1.35)
    for i, line in enumerate(lines[:max_lines]):
        if not line.strip():
            continue
        ly = y + i * line_height
        if align == "center" and area_width:
            tw = _text_width(font, line)
            lx = x + (area_width - tw) // 2
        elif align == "right" and area_width:
            tw = _text_width(font, line)
            lx = x + area_width - tw
        else:
            lx = x
        draw.text((lx, ly), line, font=font, fill=fill)


def _draw_bullet_rows(
    img: Image.Image, items: list[str],
    x: int, y: int, width: int,
    text_rgba: tuple, accent_rgb: tuple,
    font_size: int = 34, row_height: int = 60,
):
    """Accent row-card bullets with filled circles and alternating backgrounds."""
    font = _get_font(bold=False, size=font_size)
    cy = y
    for i, item in enumerate(items):
        if not item:
            continue
        if i % 2 == 0:
            _draw_card(img, (x - 14, cy - 4, x + width, cy + row_height - 9),
                       radius=8, fill=_rgba(accent_rgb, 0.06), shadow=False)
        # accent dot
        dot_cx, dot_cy = x + 8, cy + font_size // 2 + 2
        draw = ImageDraw.Draw(img)
        draw.ellipse((dot_cx - 6, dot_cy - 6, dot_cx + 6, dot_cy + 6),
                     fill=_rgba(accent_rgb, 1.0))
        # text
        text_lines = _wrap_text(item, font, width - 44)
        for li, line in enumerate(text_lines[:2]):
            draw.text((x + 28, cy + li * (font_size + 8)), line,
                      font=font, fill=text_rgba)
        line_count = min(len(text_lines), 2)
        cy += row_height + max(0, line_count - 1) * (font_size + 8)
    return cy


# ── background patterns ────────────────────────────────────────────────────

BG_PATTERNS = {"none", "circles", "triangles", "blobs", "dots"}


def _draw_bg_pattern(img, pattern, accent_rgb, text_rgb, slide_idx):
    """Dispatch to the appropriate background pattern renderer."""
    if not pattern or pattern == "none":
        return
    renderer = {
        "circles": _draw_bg_circles,
        "triangles": _draw_bg_triangles,
        "blobs": _draw_bg_blobs,
        "dots": _draw_bg_dots,
    }.get(pattern)
    if renderer:
        renderer(img, accent_rgb, text_rgb, slide_idx)


def _draw_bg_circles(img, accent_rgb, text_rgb, slide_idx):
    """Large translucent circles + small filled dots + small ring outlines."""
    w, h = img.size
    rng = _random.Random(slide_idx * 7 + 42)

    # Large translucent circles
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(rng.randint(5, 7)):
        cx = rng.randint(-120, w + 80)
        cy = rng.randint(-120, h + 80)
        r = rng.randint(100, 280)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=_rgba(accent_rgb, 0.06))
    img.alpha_composite(layer)

    # Small filled dots + ring outlines
    detail = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(detail)
    for _ in range(rng.randint(5, 7)):
        dx, dy = rng.randint(30, w - 30), rng.randint(30, h - 30)
        dd.ellipse((dx - 4, dy - 4, dx + 4, dy + 4), fill=_rgba(accent_rgb, 0.80))
    for _ in range(rng.randint(2, 4)):
        rx, ry = rng.randint(60, w - 60), rng.randint(60, h - 60)
        dd.ellipse((rx - 16, ry - 16, rx + 16, ry + 16),
                   outline=_rgba(accent_rgb, 0.75), width=3)
    img.alpha_composite(detail)


def _draw_bg_triangles(img, accent_rgb, text_rgb, slide_idx):
    """Large translucent triangles + small dots + small outline triangles."""
    w, h = img.size
    rng = _random.Random(slide_idx * 11 + 73)

    # Large translucent triangles
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(rng.randint(5, 7)):
        cx = rng.randint(-80, w + 80)
        cy = rng.randint(-80, h + 80)
        size = rng.randint(150, 350)
        angle = rng.uniform(0, 2 * math.pi)
        verts = [
            (cx + size * math.cos(angle + i * 2 * math.pi / 3),
             cy + size * math.sin(angle + i * 2 * math.pi / 3))
            for i in range(3)
        ]
        d.polygon(verts, fill=_rgba(accent_rgb, 0.06))
    img.alpha_composite(layer)

    # Small filled dots + outline triangles
    detail = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(detail)
    for _ in range(rng.randint(4, 6)):
        dx, dy = rng.randint(30, w - 30), rng.randint(30, h - 30)
        dd.ellipse((dx - 4, dy - 4, dx + 4, dy + 4), fill=_rgba(accent_rgb, 0.80))
    for _ in range(rng.randint(2, 4)):
        cx, cy = rng.randint(60, w - 60), rng.randint(60, h - 60)
        s = rng.randint(14, 22)
        angle = rng.uniform(0, 2 * math.pi)
        verts = [
            (cx + s * math.cos(angle + i * 2 * math.pi / 3),
             cy + s * math.sin(angle + i * 2 * math.pi / 3))
            for i in range(3)
        ]
        outline_color = _rgba(accent_rgb, 0.75)
        for j in range(3):
            dd.line([verts[j], verts[(j + 1) % 3]], fill=outline_color, width=2)
    img.alpha_composite(detail)


def _draw_bg_blobs(img, accent_rgb, text_rgb, slide_idx):
    """Organic corner blobs + dot grids."""
    w, h = img.size
    rng = _random.Random(slide_idx * 13 + 97)

    # Two blobs in opposite corners (alternate per slide)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    blob_fill = _rgba(accent_rgb, 0.88)

    if slide_idx % 2 == 0:
        blob_centers = [(-20, -20), (w + 20, h + 20)]
    else:
        blob_centers = [(w + 20, -20), (-20, h + 20)]

    for bcx, bcy in blob_centers:
        for _ in range(5):
            ox = rng.randint(-50, 50)
            oy = rng.randint(-50, 50)
            r = rng.randint(60, 130)
            d.ellipse((bcx + ox - r, bcy + oy - r, bcx + ox + r, bcy + oy + r),
                      fill=blob_fill)
    img.alpha_composite(layer)

    # Dot grids near the blobs
    grid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    grid_fill = _rgba(accent_rgb, 0.55)

    if slide_idx % 2 == 0:
        grid_origins = [
            (w // 2 + rng.randint(20, 100), 30 + rng.randint(0, 30)),
            (w - 200 + rng.randint(0, 40), h - 200 + rng.randint(0, 40)),
        ]
    else:
        grid_origins = [
            (60 + rng.randint(0, 60), h // 2 + rng.randint(0, 60)),
            (w - 200 + rng.randint(0, 40), 30 + rng.randint(0, 30)),
        ]

    spacing = 22
    for gx, gy in grid_origins:
        rows = rng.randint(4, 6)
        cols = rng.randint(4, 6)
        for row in range(rows):
            for col in range(cols):
                dx = gx + col * spacing
                dy = gy + row * spacing
                gd.ellipse((dx - 3, dy - 3, dx + 3, dy + 3), fill=grid_fill)
    img.alpha_composite(grid)


def _draw_bg_dots(img, accent_rgb, text_rgb, slide_idx):
    """Diamond-shaped dot grid cluster + bottom row of dots."""
    w, h = img.size
    rng = _random.Random(slide_idx * 17 + 113)

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    dot_fill = _rgba(accent_rgb, 0.38)

    # Large diamond-shaped dot grid in one corner
    corner = slide_idx % 4
    spacing = 32
    max_rows = 8
    if corner == 0:       # top-right
        ox, oy, dx_dir = w - 60, 40, -1
    elif corner == 1:     # top-left
        ox, oy, dx_dir = 60, 40, 1
    elif corner == 2:     # bottom-right
        ox, oy, dx_dir = w - 60, h - 320, -1
    else:                 # bottom-left
        ox, oy, dx_dir = 60, h - 320, 1

    for row in range(max_rows):
        cols_in_row = max_rows - row
        for col in range(cols_in_row):
            dx = ox + dx_dir * col * spacing
            dy = oy + row * spacing
            d.ellipse((dx - 5, dy - 5, dx + 5, dy + 5), fill=dot_fill)

    # Bottom edge row of dots
    bottom_y = h - 40
    dot_spacing = rng.randint(36, 48)
    num_dots = w // dot_spacing + 1
    for i in range(num_dots):
        dx = i * dot_spacing + rng.randint(-3, 3)
        r = rng.randint(4, 7)
        d.ellipse((dx - r, bottom_y - r, dx + r, bottom_y + r),
                  fill=_rgba(accent_rgb, 0.28))
    img.alpha_composite(layer)


# ── slide renderers ───────────────────────────────────────────────────────

_SAFE_TOP = 60       # below 10px accent bar + padding
_SAFE_BOTTOM = 100   # above footer


def _render_hook_slide(img, slide, margin, cw, text_rgba, accent_rgb):
    """Left-aligned hook — big headline + body text, no divider bar."""
    hl_font = _get_font(bold=True, size=74)
    bd_font = _get_font(bold=False, size=34)

    hl_lines = _wrap_text(slide.headline, hl_font, cw)
    bd_lines = _wrap_text(slide.body_text, bd_font, cw - 20)

    hl_lh, bd_lh = 88, 48
    hl_h = max(1, len(hl_lines)) * hl_lh
    bd_h = max(1, len(bd_lines)) * bd_lh
    gap = 36
    total = hl_h + gap + bd_h

    top = _SAFE_TOP + (SLIDE_HEIGHT - _SAFE_TOP - _SAFE_BOTTOM - total) // 2

    _draw_text(img, hl_lines, margin, top, hl_font, text_rgba,
               align="left", line_height=hl_lh, max_lines=3)

    bd_y = top + hl_h + gap
    _draw_text(img, bd_lines, margin, bd_y, bd_font, text_rgba,
               align="left", line_height=bd_lh, max_lines=5)


def _render_middle_slide(img, slide, margin, cw, text_rgba, accent_rgb):
    """Left-aligned content slide — number badge, headline, body text."""
    draw = ImageDraw.Draw(img)
    hl_font = _get_font(bold=True, size=74)
    bd_font = _get_font(bold=False, size=34)

    hl_lines = _wrap_text(slide.headline, hl_font, cw)
    bd_lines = _wrap_text(slide.body_text or "", bd_font, cw - 20)

    hl_lh, bd_lh = 88, 48
    hl_h = max(1, len(hl_lines)) * hl_lh
    bd_h = max(1, len(bd_lines)) * bd_lh
    badge_d = 70
    gap_badge = 24
    gap_body = 36
    total = badge_d + gap_badge + hl_h + gap_body + bd_h

    top = _SAFE_TOP + (SLIDE_HEIGHT - _SAFE_TOP - _SAFE_BOTTOM - total) // 2

    # Number badge — filled circle
    badge_cx = margin + badge_d // 2
    badge_cy = top + badge_d // 2
    draw.ellipse(
        (badge_cx - badge_d // 2, badge_cy - badge_d // 2,
         badge_cx + badge_d // 2, badge_cy + badge_d // 2),
        fill=_rgba(accent_rgb, 1.0),
    )
    nf = _get_font(bold=True, size=34)
    num_text = str(slide.slide_number - 1)
    ntw = _text_width(nf, num_text)
    draw.text((badge_cx - ntw // 2, badge_cy - 17), num_text,
              font=nf, fill=_contrast_text_rgba(accent_rgb))

    # Headline
    hl_y = top + badge_d + gap_badge
    _draw_text(img, hl_lines, margin, hl_y, hl_font, text_rgba,
               align="left", line_height=hl_lh, max_lines=3)

    # Body text
    bd_y = hl_y + hl_h + gap_body
    _draw_text(img, bd_lines, margin, bd_y, bd_font, text_rgba,
               align="left", line_height=bd_lh, max_lines=8)


def _render_result_slide(img, slide, margin, cw, text_rgba, accent_rgb):
    """Left-aligned result slide — number badge, headline, body text."""
    draw = ImageDraw.Draw(img)
    hl_font = _get_font(bold=True, size=74)
    bd_font = _get_font(bold=False, size=34)

    hl_lines = _wrap_text(slide.headline, hl_font, cw)
    bd_lines = _wrap_text(slide.body_text or "", bd_font, cw - 20)

    hl_lh, bd_lh = 88, 48
    hl_h = max(1, len(hl_lines)) * hl_lh
    bd_h = max(1, len(bd_lines)) * bd_lh
    badge_d = 70
    gap_badge = 24
    gap_body = 36
    total = badge_d + gap_badge + hl_h + gap_body + bd_h

    top = _SAFE_TOP + (SLIDE_HEIGHT - _SAFE_TOP - _SAFE_BOTTOM - total) // 2

    # Number badge — filled circle
    badge_cx = margin + badge_d // 2
    badge_cy = top + badge_d // 2
    draw.ellipse(
        (badge_cx - badge_d // 2, badge_cy - badge_d // 2,
         badge_cx + badge_d // 2, badge_cy + badge_d // 2),
        fill=_rgba(accent_rgb, 1.0),
    )
    nf = _get_font(bold=True, size=34)
    num_text = str(slide.slide_number - 1)
    ntw = _text_width(nf, num_text)
    draw.text((badge_cx - ntw // 2, badge_cy - 17), num_text,
              font=nf, fill=_contrast_text_rgba(accent_rgb))

    # Headline
    hl_y = top + badge_d + gap_badge
    _draw_text(img, hl_lines, margin, hl_y, hl_font, text_rgba,
               align="left", line_height=hl_lh, max_lines=3)

    # Body text
    bd_y = hl_y + hl_h + gap_body
    _draw_text(img, bd_lines, margin, bd_y, bd_font, text_rgba,
               align="left", line_height=bd_lh, max_lines=8)


def _render_tldr_slide(img, slide, margin, cw, text_rgba, accent_rgb):
    """Left-aligned TL;DR slide — number badge, headline, body text."""
    draw = ImageDraw.Draw(img)
    hl_font = _get_font(bold=True, size=74)
    bd_font = _get_font(bold=False, size=34)

    hl_text = slide.headline if slide.headline and "tldr" not in slide.headline.lower() else "What Matters Most"
    hl_lines = _wrap_text(hl_text, hl_font, cw)
    bd_lines = _wrap_text(slide.body_text or "", bd_font, cw - 20)

    hl_lh, bd_lh = 88, 48
    hl_h = max(1, len(hl_lines)) * hl_lh
    bd_h = max(1, len(bd_lines)) * bd_lh
    badge_d = 70
    gap_badge = 24
    gap_body = 36
    total = badge_d + gap_badge + hl_h + gap_body + bd_h

    top = _SAFE_TOP + (SLIDE_HEIGHT - _SAFE_TOP - _SAFE_BOTTOM - total) // 2

    # Number badge — filled circle
    badge_cx = margin + badge_d // 2
    badge_cy = top + badge_d // 2
    draw.ellipse(
        (badge_cx - badge_d // 2, badge_cy - badge_d // 2,
         badge_cx + badge_d // 2, badge_cy + badge_d // 2),
        fill=_rgba(accent_rgb, 1.0),
    )
    nf = _get_font(bold=True, size=34)
    num_text = str(slide.slide_number - 1)
    ntw = _text_width(nf, num_text)
    draw.text((badge_cx - ntw // 2, badge_cy - 17), num_text,
              font=nf, fill=_contrast_text_rgba(accent_rgb))

    # Headline
    hl_y = top + badge_d + gap_badge
    _draw_text(img, hl_lines, margin, hl_y, hl_font, text_rgba,
               align="left", line_height=hl_lh, max_lines=3)

    # Body text
    bd_y = hl_y + hl_h + gap_body
    _draw_text(img, bd_lines, margin, bd_y, bd_font, text_rgba,
               align="left", line_height=bd_lh, max_lines=8)


def _render_cta_slide(img, slide, margin, cw, text_rgba, accent_rgb):
    """Left-aligned CTA — number badge, headline, body text."""
    draw = ImageDraw.Draw(img)
    hl_font = _get_font(bold=True, size=74)
    bd_font = _get_font(bold=False, size=34)

    hl_lines = _wrap_text(slide.headline, hl_font, cw)
    bd_lines = _wrap_text(slide.body_text or "", bd_font, cw - 20)

    hl_lh, bd_lh = 88, 48
    hl_h = max(1, len(hl_lines)) * hl_lh
    bd_h = max(1, len(bd_lines)) * bd_lh
    badge_d = 70
    gap_badge = 24
    gap_body = 36
    total = badge_d + gap_badge + hl_h + gap_body + bd_h

    top = _SAFE_TOP + (SLIDE_HEIGHT - _SAFE_TOP - _SAFE_BOTTOM - total) // 2

    # Number badge — filled circle
    badge_cx = margin + badge_d // 2
    badge_cy = top + badge_d // 2
    draw.ellipse(
        (badge_cx - badge_d // 2, badge_cy - badge_d // 2,
         badge_cx + badge_d // 2, badge_cy + badge_d // 2),
        fill=_rgba(accent_rgb, 1.0),
    )
    nf = _get_font(bold=True, size=34)
    num_text = str(slide.slide_number - 1)
    ntw = _text_width(nf, num_text)
    draw.text((badge_cx - ntw // 2, badge_cy - 17), num_text,
              font=nf, fill=_contrast_text_rgba(accent_rgb))

    # Headline
    hl_y = top + badge_d + gap_badge
    _draw_text(img, hl_lines, margin, hl_y, hl_font, text_rgba,
               align="left", line_height=hl_lh, max_lines=3)

    # Body text
    bd_y = hl_y + hl_h + gap_body
    _draw_text(img, bd_lines, margin, bd_y, bd_font, text_rgba,
               align="left", line_height=bd_lh, max_lines=8)


def _draw_footer(img, idx, total_slides, margin, text_rgba, accent_rgb):
    """Slide counter + Acta AI branding + swipe prompt."""
    draw = ImageDraw.Draw(img)
    is_last = idx == total_slides - 1
    y_bottom = SLIDE_HEIGHT - 50

    pg_font = _get_font(bold=False, size=20)
    draw.text((margin, y_bottom), f"{idx + 1} / {total_slides}",
              font=pg_font, fill=_rgba(text_rgba[:3], 0.55))

    if not is_last:
        sw_font = _get_font(bold=True, size=22)
        sw_text = "SWIPE >"
        sw_w = _text_width(sw_font, sw_text)
        draw.text((SLIDE_WIDTH - margin - sw_w, y_bottom), sw_text,
                  font=sw_font, fill=_rgba(accent_rgb, 1.0))


# ── main renderer ─────────────────────────────────────────────────────────


def render_carousel_pdf(slides: list[CarouselSlide], branding: dict) -> bytes:
    """Render slides to PDF using Pillow (pixel-perfect, anti-aliased)."""
    rgb_top = _hex_to_rgb(branding["primary_color"])
    rgb_bottom = _hex_to_rgb(branding["secondary_color"])
    text_rgb = _hex_to_rgb(branding["text_color"])
    accent_rgb = _hex_to_rgb(branding["accent_color"])
    text_rgba = _rgba(text_rgb, 1.0)
    bg_pattern = branding.get("bg_pattern", "none")

    margin = 70
    cw = SLIDE_WIDTH - margin * 2
    total = len(slides)

    page_images: list[Image.Image] = []

    for idx, slide in enumerate(slides):
        img = Image.new("RGBA", (SLIDE_WIDTH, SLIDE_HEIGHT), (0, 0, 0, 255))
        _draw_gradient(img, rgb_top, rgb_bottom)

        # Background decorative pattern
        _draw_bg_pattern(img, bg_pattern, accent_rgb, text_rgb, idx)

        # Top accent bar
        draw = ImageDraw.Draw(img)
        draw.rectangle((0, 0, SLIDE_WIDTH, 10), fill=_rgba(accent_rgb, 1.0))

        stype = _normalize_slide_type(slide.slide_type)
        if stype == "hook":
            _render_hook_slide(img, slide, margin, cw, text_rgba, accent_rgb)
        elif stype == "result":
            _render_result_slide(img, slide, margin, cw, text_rgba, accent_rgb)
        elif stype == "tldr":
            _render_tldr_slide(img, slide, margin, cw, text_rgba, accent_rgb)
        elif stype == "cta":
            _render_cta_slide(img, slide, margin, cw, text_rgba, accent_rgb)
        else:
            _render_middle_slide(img, slide, margin, cw, text_rgba, accent_rgb)

        _draw_footer(img, idx, total, margin, text_rgba, accent_rgb)

        # Convert RGBA -> RGB for PDF
        page_images.append(img.convert("RGB"))

    # Assemble multi-page PDF
    buf = io.BytesIO()
    if page_images:
        page_images[0].save(
            buf, "PDF", save_all=True,
            append_images=page_images[1:],
            resolution=72.0,
        )
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


async def generate_carousel(
    content_html: str,
    title: str,
    template=None,
    request_branding=None,
    featured_image_url: str | None = None,
) -> CarouselResult:
    """Full pipeline: AI slides + resolve branding + render PDF."""
    industry = template.industry if template else None

    slides, ai_response = await generate_carousel_slides(
        content_html,
        title,
        template=template,
        industry=industry,
    )

    branding = resolve_branding(template, request_branding)
    pdf_bytes = render_carousel_pdf(slides, branding)

    return CarouselResult(
        pdf_bytes=pdf_bytes,
        slide_count=len(slides),
        prompt_tokens=ai_response.prompt_tokens,
        completion_tokens=ai_response.completion_tokens,
        total_tokens=ai_response.total_tokens,
        image_cost_usd=0.0,
    )
