"""LinkedIn carousel PDF generation service.

Structures blog content into 5-7 branded slides via one GPT-4o call
with stronger narrative constraints, then renders a downloadable PDF
using varied layout patterns in ReportLab.
"""

import io
import json
import logging
import os
import re
from dataclasses import dataclass

import httpx
from PIL import Image, ImageOps
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.services.content import (
    OpenAIResponse,
    _build_linkedin_banned_list,
    _build_linkedin_voice_section,
    _call_openai,
    _linkedin_tone_for_industry,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Font registration (runs once on import)
# ---------------------------------------------------------------------------

_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")

_fonts_registered = False


def _register_fonts():
    global _fonts_registered
    if _fonts_registered:
        return
    try:
        pdfmetrics.registerFont(TTFont("Cinzel", os.path.join(_FONTS_DIR, "Cinzel-Variable.ttf")))
        pdfmetrics.registerFont(TTFont("Inter", os.path.join(_FONTS_DIR, "Inter-Variable.ttf")))
        _fonts_registered = True
        logger.info("Carousel fonts registered successfully")
    except Exception as e:
        logger.error(f"Failed to register carousel fonts: {e}")
        raise


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
    "roman_patina": {
        "primary_color": "#2D4A3E",      # dark patina green
        "secondary_color": "#1A3028",     # deeper green for gradient bottom
        "text_color": "#FFFFFF",
        "accent_color": "#D4A574",        # bronze
    },
    "clean_white": {
        "primary_color": "#FFFFFF",
        "secondary_color": "#F5F3F0",     # warm stone
        "text_color": "#2A2520",
        "accent_color": "#4A7C6F",        # patina green
    },
    "dark_professional": {
        "primary_color": "#1B2838",       # dark navy
        "secondary_color": "#0F1923",     # deeper navy
        "text_color": "#FFFFFF",
        "accent_color": "#5BA4B5",        # teal accent
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

    Returns a complete dict with all color keys.
    """
    # Start with default preset
    preset_name = "roman_patina"
    result = dict(CAROUSEL_PRESETS["roman_patina"])

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

    result["preset"] = preset_name
    return result


# ---------------------------------------------------------------------------
# Image sourcing for hero slides
# ---------------------------------------------------------------------------

DALLE3_COST = 0.04  # standard quality 1792x1024


async def _download_image(url: str) -> bytes | None:
    """Download an image URL and return raw bytes. Non-fatal."""
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            if len(resp.content) < 1000:
                logger.warning("Carousel image download too small (%d bytes)", len(resp.content))
                return None
            return resp.content
    except Exception as e:
        logger.warning("Carousel image download failed: %s", e)
        return None


async def _get_carousel_image(
    featured_image_url: str | None,
    title: str,
    industry: str | None = None,
) -> tuple[bytes | None, float]:
    """Try to get an image for hero slides with fallback chain.

    Returns (image_bytes, cost) where cost is 0.0 if existing image used,
    or DALLE3_COST if a new image was generated.
    """
    # Step 1: Try the post's existing featured image
    if featured_image_url:
        image_bytes = await _download_image(featured_image_url)
        if image_bytes:
            logger.info("Carousel using existing featured image")
            return image_bytes, 0.0

    # Step 2: Generate a new abstract DALL-E image as fallback
    from app.services.images import generate_featured_image

    dalle_url = await generate_featured_image(
        source="dalle",
        title=title,
        industry=industry,
        style_guidance="Abstract editorial background, cinematic lighting, no text overlay, moody atmosphere",
    )
    if dalle_url:
        image_bytes = await _download_image(dalle_url)
        if image_bytes:
            logger.info("Carousel generated new DALL-E hero image")
            return image_bytes, DALLE3_COST

    # Step 3: Graceful degradation — no image, gradient-only
    logger.info("Carousel falling back to gradient-only (no hero image)")
    return None, 0.0


def _prepare_slide_image(image_bytes: bytes) -> ImageReader | None:
    """Load and cover-crop image to slide dimensions for ReportLab."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img = ImageOps.fit(img, (SLIDE_WIDTH, SLIDE_HEIGHT), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return ImageReader(buf)
    except Exception as e:
        logger.warning("Failed to prepare carousel slide image: %s", e)
        return None


def _draw_dark_overlay(c, alpha_top: float = 0.35, alpha_bottom: float = 0.82, steps: int = 60):
    """Draw a dark gradient overlay for text readability on image backgrounds."""
    strip_height = SLIDE_HEIGHT / steps
    c.saveState()
    c.setFillColor(Color(0, 0, 0))
    for i in range(steps):
        t = i / (steps - 1) if steps > 1 else 0
        alpha = alpha_top + (alpha_bottom - alpha_top) * t
        c.setFillAlpha(alpha)
        strip_y = SLIDE_HEIGHT - (i + 1) * strip_height
        c.rect(0, strip_y, SLIDE_WIDTH, strip_height + 0.5, fill=1, stroke=0)
    c.restoreState()


# ---------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------


def _draw_gradient(c, x, y, width, height, color_top, color_bottom, steps=80):
    """Draw a vertical gradient by stacking thin horizontal rectangles."""
    strip_height = height / steps
    r1, g1, b1 = color_top.red, color_top.green, color_top.blue
    r2, g2, b2 = color_bottom.red, color_bottom.green, color_bottom.blue

    for i in range(steps):
        t = i / (steps - 1) if steps > 1 else 0
        r = r1 + (r2 - r1) * t
        g = g1 + (g2 - g1) * t
        b = b1 + (b2 - b1) * t
        c.setFillColor(Color(r, g, b))
        strip_y = y + height - (i + 1) * strip_height
        c.rect(x, strip_y, width, strip_height + 0.5, fill=1, stroke=0)


def _alpha(color: Color, alpha: float) -> Color:
    """Apply alpha to an existing color."""
    return Color(color.red, color.green, color.blue, alpha=alpha)


def _contrast_text(color: Color) -> Color:
    """Return black/white text color with better contrast on the given background."""
    luminance = 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue
    return HexColor("#111111") if luminance > 0.6 else HexColor("#FFFFFF")


def _draw_background_texture(c, accent_color: Color, text_color: Color, idx: int, slide_type: str):
    """Subtle geometric texture so each slide feels less flat."""
    c.saveState()
    c.setLineWidth(2)
    c.setStrokeColor(_alpha(accent_color, 0.14))

    # Rotating circles make the deck feel alive without visual noise.
    c.circle(SLIDE_WIDTH - 170, SLIDE_HEIGHT - 200, 120 + (idx % 3) * 16, stroke=1, fill=0)
    c.circle(145, 190, 82 + (idx % 2) * 12, stroke=1, fill=0)

    c.setFillColor(_alpha(text_color, 0.06))
    c.roundRect(45, 40, 270, 110, 18, fill=1, stroke=0)

    c.setFillColor(_alpha(accent_color, 0.08))
    if slide_type in {"hook", "cta", "tldr"}:
        c.roundRect(70, 870, SLIDE_WIDTH - 140, 350, 32, fill=1, stroke=0)
    else:
        c.rect(0, 285, SLIDE_WIDTH, 5, fill=1, stroke=0)
    c.restoreState()


def _wrap_text(c, text, font_name, font_size, max_width):
    """Simple word-wrap that returns list of lines."""
    source = (text or "").strip()
    if not source:
        return []

    lines: list[str] = []
    paragraphs = source.split("\n")
    for p_idx, paragraph in enumerate(paragraphs):
        paragraph = paragraph.strip()
        if not paragraph:
            if lines and lines[-1] != "":
                lines.append("")
            continue

        words = paragraph.split()
        current_line = ""
        for word in words:
            test_line = f"{current_line} {word}".strip() if current_line else word
            width = c.stringWidth(test_line, font_name, font_size)
            if width <= max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        if current_line:
            lines.append(current_line)

        # Preserve explicit paragraph breaks for bullet lists.
        if p_idx < len(paragraphs) - 1 and lines and lines[-1] != "":
            lines.append("")

    # Avoid trailing blank spacer.
    while lines and lines[-1] == "":
        lines.pop()
    return lines


def _draw_lines(c, lines, x, start_y, line_height, max_lines, align="left", bullet_mode=False):
    """Draw wrapped lines with optional center/right alignment."""
    for line_idx, line in enumerate(lines[:max_lines]):
        y = start_y - line_idx * line_height
        stripped = line.strip()
        if not stripped:
            continue

        if bullet_mode and align == "left" and stripped.startswith(("•", "-")):
            body = stripped.lstrip("•- ").strip()
            c.drawString(x, y, "•")
            c.drawString(x + 26, y, body)
            continue

        if align == "center":
            c.drawCentredString(x, y, line)
        elif align == "right":
            c.drawRightString(x, y, line)
        else:
            c.drawString(x, y, line)


def _render_hook_slide(
    c, slide: CarouselSlide, margin: int, content_width: int,
    text_color: Color, accent_color: Color, image_reader: ImageReader | None = None,
):
    """Center-led hook layout optimized for first-slide stoppage."""
    center_x = SLIDE_WIDTH / 2

    if image_reader:
        # Full-bleed image background with dark overlay
        c.drawImage(image_reader, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, preserveAspectRatio=False)
        _draw_dark_overlay(c, alpha_top=0.35, alpha_bottom=0.82)
        # Force white text for readability over image
        effective_text = HexColor("#FFFFFF")
        effective_accent = HexColor("#FFFFFF")
    else:
        effective_text = text_color
        effective_accent = accent_color

    c.setFillColor(effective_text)
    c.setFont("Cinzel", 68)
    headline_lines = _wrap_text(c, slide.headline, "Cinzel", 68, content_width - 60)
    _draw_lines(c, headline_lines, center_x, SLIDE_HEIGHT - 400, 82, 3, align="center")

    c.setFillColor(effective_accent)
    c.rect(center_x - 72, SLIDE_HEIGHT - 650, 144, 5, fill=1, stroke=0)

    c.setFillColor(effective_text)
    c.setFont("Inter", 31)
    body_lines = _wrap_text(c, slide.body_text, "Inter", 31, content_width - 160)
    _draw_lines(c, body_lines, center_x, SLIDE_HEIGHT - 720, 43, 5, align="center")


def _render_middle_slide(c, slide: CarouselSlide, margin: int, content_width: int, text_color: Color, accent_color: Color):
    """Problem/insight layout with big numbered anchor and accent left border."""
    headline_font = 47
    body_font = 31
    headline_y = SLIDE_HEIGHT - 170
    reserved_right = 300 if slide.key_stat else 0
    text_width = content_width - reserved_right

    # Big slide number watermark in top-right corner
    c.saveState()
    c.setFillColor(_alpha(accent_color, 0.10))
    c.setFont("Inter", 120)
    slide_num_label = f"{slide.slide_number - 1:02d}"  # "01", "02", etc. (skip hook)
    c.drawRightString(SLIDE_WIDTH - margin + 10, SLIDE_HEIGHT - 155, slide_num_label)
    c.restoreState()

    c.setFillColor(text_color)
    c.setFont("Cinzel", headline_font)
    headline_lines = _wrap_text(c, slide.headline, "Cinzel", headline_font, text_width)
    _draw_lines(c, headline_lines, margin, headline_y, headline_font + 12, 3)

    # Accent left border bar for bullet section instead of short underline
    bullet_top_y = headline_y - len(headline_lines[:3]) * (headline_font + 12) - 20
    bar_height = 280  # approximate height of bullet section
    c.setFillColor(accent_color)
    c.rect(margin - 6, bullet_top_y - bar_height, 4, bar_height, fill=1, stroke=0)

    if slide.key_stat:
        card_w = 245
        card_h = 152
        card_x = SLIDE_WIDTH - margin - card_w
        card_y = SLIDE_HEIGHT - 390
        # Bordered card instead of just fill
        c.setFillColor(_alpha(accent_color, 0.12))
        c.roundRect(card_x, card_y, card_w, card_h, 16, fill=1, stroke=0)
        c.setStrokeColor(_alpha(accent_color, 0.45))
        c.setLineWidth(2)
        c.roundRect(card_x, card_y, card_w, card_h, 16, fill=0, stroke=1)
        c.setFillColor(accent_color)
        c.setFont("Inter", 58)
        c.drawCentredString(card_x + card_w / 2, card_y + 56, slide.key_stat)

    c.setFillColor(text_color)
    c.setFont("Inter", body_font)
    body_lines = _wrap_text(c, slide.body_text, "Inter", body_font, text_width)
    _draw_lines(c, body_lines, margin + 14, bullet_top_y - 16, body_font + 14, 10, bullet_mode=True)


def _render_result_slide(c, slide: CarouselSlide, margin: int, content_width: int, text_color: Color, accent_color: Color):
    """Result slide: proof-heavy composition centered around the key number."""
    center_x = SLIDE_WIDTH / 2

    c.setFillColor(text_color)
    c.setFont("Cinzel", 46)
    headline_lines = _wrap_text(c, slide.headline, "Cinzel", 46, content_width - 40)
    _draw_lines(c, headline_lines, center_x, SLIDE_HEIGHT - 220, 58, 2, align="center")

    stat_value = slide.key_stat or "Outcome"
    stat_w = 520
    stat_h = 220
    stat_x = center_x - stat_w / 2
    stat_y = SLIDE_HEIGHT - 640
    c.setFillColor(_alpha(accent_color, 0.2))
    c.roundRect(stat_x, stat_y, stat_w, stat_h, 22, fill=1, stroke=0)
    c.setFillColor(accent_color)
    c.setFont("Inter", 94 if len(stat_value) <= 6 else 76)
    c.drawCentredString(center_x, stat_y + 78, stat_value)

    c.setFillColor(text_color)
    c.setFont("Inter", 30)
    body_lines = _wrap_text(c, slide.body_text, "Inter", 30, content_width - 120)
    _draw_lines(c, body_lines, center_x, stat_y - 60, 42, 5, align="center")


def _render_tldr_slide(c, slide: CarouselSlide, margin: int, content_width: int, text_color: Color, accent_color: Color):
    """TL;DR slide with numbered takeaways instead of plain bullets."""
    center_x = SLIDE_WIDTH / 2

    c.setFillColor(accent_color)
    c.roundRect(center_x - 140, SLIDE_HEIGHT - 215, 280, 54, 14, fill=1, stroke=0)
    c.setFillColor(_contrast_text(accent_color))
    c.setFont("Inter", 30)
    c.drawCentredString(center_x, SLIDE_HEIGHT - 198, "TL;DR")

    c.setFillColor(text_color)
    c.setFont("Cinzel", 44)
    headline_text = slide.headline if slide.headline and "tldr" not in slide.headline.lower() else "What Matters Most"
    headline_lines = _wrap_text(c, headline_text, "Cinzel", 44, content_width - 80)
    _draw_lines(c, headline_lines, center_x, SLIDE_HEIGHT - 308, 56, 2, align="center")

    # Content card with more padding
    card_x = margin - 10
    card_y = SLIDE_HEIGHT - 940
    card_w = content_width + 20
    card_h = 450
    c.setFillColor(_alpha(accent_color, 0.16))
    c.roundRect(card_x, card_y, card_w, card_h, 22, fill=1, stroke=0)

    # Draw numbered takeaway items instead of plain bullets
    body_text = slide.body_text or ""
    items = [ln.strip().lstrip("•-– ").strip() for ln in body_text.splitlines() if ln.strip()]
    item_y = SLIDE_HEIGHT - 560
    item_font = 31
    item_spacing = 50
    inner_margin = margin + 30

    for i, item in enumerate(items[:6]):
        if not item:
            continue
        # Accent-colored number
        c.setFillColor(accent_color)
        c.setFont("Inter", 36)
        c.drawString(inner_margin, item_y, f"{i + 1}.")
        # Item text
        c.setFillColor(text_color)
        c.setFont("Inter", item_font)
        item_lines = _wrap_text(c, item, "Inter", item_font, content_width - 100)
        for line_idx, line in enumerate(item_lines[:2]):
            c.drawString(inner_margin + 48, item_y - line_idx * (item_font + 10), line)
        item_y -= item_spacing + (len(item_lines[:2]) - 1) * (item_font + 10)


def _render_cta_slide(
    c, slide: CarouselSlide, margin: int, content_width: int,
    text_color: Color, accent_color: Color, image_reader: ImageReader | None = None,
):
    """Final slide layout that invites specific discussion."""
    center_x = SLIDE_WIDTH / 2

    if image_reader:
        # Full-bleed image with heavier overlay (more subdued for discussion slide)
        c.drawImage(image_reader, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, preserveAspectRatio=False)
        _draw_dark_overlay(c, alpha_top=0.50, alpha_bottom=0.88)
        effective_text = HexColor("#FFFFFF")
        effective_accent = HexColor("#FFFFFF")
    else:
        effective_text = text_color
        effective_accent = accent_color

    c.setFillColor(effective_text)
    c.setFont("Cinzel", 58)
    headline_lines = _wrap_text(c, slide.headline, "Cinzel", 58, content_width - 80)
    _draw_lines(c, headline_lines, center_x, SLIDE_HEIGHT - 300, 72, 3, align="center")

    # "YOUR TAKE?" pill — use original accent if no image, semi-transparent white if image
    if image_reader:
        c.saveState()
        c.setFillColor(Color(1, 1, 1))
        c.setFillAlpha(0.20)
        c.roundRect(center_x - 180, SLIDE_HEIGHT - 520, 360, 46, 12, fill=1, stroke=0)
        c.restoreState()
        c.setFillColor(HexColor("#FFFFFF"))
    else:
        c.setFillColor(accent_color)
        c.roundRect(center_x - 180, SLIDE_HEIGHT - 520, 360, 46, 12, fill=1, stroke=0)
        c.setFillColor(_contrast_text(accent_color))
    c.setFont("Inter", 24)
    c.drawCentredString(center_x, SLIDE_HEIGHT - 506, "YOUR TAKE?")

    c.setFillColor(effective_text)
    c.setFont("Inter", 32)
    body_lines = _wrap_text(c, slide.body_text, "Inter", 32, content_width - 120)
    _draw_lines(c, body_lines, center_x, SLIDE_HEIGHT - 610, 43, 5, align="center")


def _draw_footer(c, idx: int, total_slides: int, margin: int, text_color: Color, accent_color: Color):
    """Shared footer UI elements."""
    is_last = idx == total_slides - 1

    c.setFillColor(_alpha(text_color, 0.55))
    c.setFont("Inter", 20)
    c.drawString(margin, 50, f"{idx + 1} / {total_slides}")

    c.setFillColor(_alpha(text_color, 0.38))
    c.setFont("Inter", 14)
    c.drawRightString(SLIDE_WIDTH - margin, 78, "Generated with Acta AI")

    if not is_last:
        c.setFillColor(accent_color)
        c.setFont("Inter", 22)
        c.drawRightString(SLIDE_WIDTH - margin, 50, "SWIPE >")


def render_carousel_pdf(
    slides: list[CarouselSlide], branding: dict, image_bytes: bytes | None = None,
) -> bytes:
    """Render slides to a branded PDF using ReportLab."""
    _register_fonts()

    # Prepare hero image once (reused on hook + CTA slides)
    image_reader = _prepare_slide_image(image_bytes) if image_bytes else None

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(SLIDE_WIDTH, SLIDE_HEIGHT))

    color_top = HexColor(branding["primary_color"])
    color_bottom = HexColor(branding["secondary_color"])
    text_color = HexColor(branding["text_color"])
    accent_color = HexColor(branding["accent_color"])

    total_slides = len(slides)
    margin = 80
    content_width = SLIDE_WIDTH - margin * 2

    for idx, slide in enumerate(slides):
        is_last = idx == total_slides - 1
        slide_type = _normalize_slide_type(slide.slide_type)
        is_hero_slide = slide_type in {"hook", "cta"} and image_reader is not None

        if not is_hero_slide:
            # --- Standard background gradient + texture ---
            _draw_gradient(c, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, color_top, color_bottom)
            _draw_background_texture(c, accent_color, text_color, idx, slide.slide_type)

        # --- Top accent bar (skip on hero slides — image is the visual) ---
        if not is_hero_slide:
            c.setFillColor(accent_color)
            c.rect(0, SLIDE_HEIGHT - 10, SLIDE_WIDTH, 10, fill=1, stroke=0)

        if slide_type == "hook":
            _render_hook_slide(c, slide, margin, content_width, text_color, accent_color, image_reader=image_reader)
        elif slide_type == "result":
            _render_result_slide(c, slide, margin, content_width, text_color, accent_color)
        elif slide_type == "tldr":
            _render_tldr_slide(c, slide, margin, content_width, text_color, accent_color)
        elif slide_type == "cta":
            _render_cta_slide(c, slide, margin, content_width, text_color, accent_color, image_reader=image_reader)
        else:
            _render_middle_slide(c, slide, margin, content_width, text_color, accent_color)

        # Footer: force white on hero slides for readability
        if is_hero_slide:
            _draw_footer(c, idx, total_slides, margin, HexColor("#FFFFFF"), HexColor("#FFFFFF"))
        else:
            _draw_footer(c, idx, total_slides, margin, text_color, accent_color)

        # --- New page (except after last slide) ---
        if not is_last:
            c.showPage()

    c.save()
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
    """Full pipeline: AI slides + hero image + resolve branding + render PDF."""
    industry = template.industry if template else None

    slides, ai_response = await generate_carousel_slides(
        content_html,
        title,
        template=template,
        industry=industry,
    )

    # Fetch hero image (existing featured image → DALL-E fallback → None)
    image_bytes, image_cost = await _get_carousel_image(
        featured_image_url, title, industry=industry,
    )

    branding = resolve_branding(template, request_branding)
    pdf_bytes = render_carousel_pdf(slides, branding, image_bytes=image_bytes)

    return CarouselResult(
        pdf_bytes=pdf_bytes,
        slide_count=len(slides),
        prompt_tokens=ai_response.prompt_tokens,
        completion_tokens=ai_response.completion_tokens,
        total_tokens=ai_response.total_tokens,
        image_cost_usd=image_cost,
    )
