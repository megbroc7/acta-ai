"""LinkedIn carousel PDF generation service.

Structures blog content into 5-7 branded slides via one GPT-4o call,
then renders a downloadable PDF using ReportLab.
"""

import io
import json
import logging
import os
from dataclasses import dataclass

from reportlab.lib.colors import Color, HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.services.content import _call_openai, OpenAIResponse

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
CAROUSEL_MAX_TOKENS = 3000
MODEL = "gpt-4o"

SLIDE_WIDTH = 1080
SLIDE_HEIGHT = 1350  # portrait — LinkedIn spec

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


# ---------------------------------------------------------------------------
# AI: Structure blog into slides
# ---------------------------------------------------------------------------

SLIDE_SYSTEM_PROMPT = """You are a LinkedIn carousel content strategist. Your job is to distil a blog article into a compelling 5-7 slide carousel that stops the scroll, delivers value, and drives engagement.

RULES:
- Return ONLY a JSON array of slide objects — no markdown, no explanation.
- Each slide object: {"slide_number": int, "type": str, "headline": str, "body_text": str, "key_stat": str|null}
- Slide types in order: "hook" (slide 1), then "problem" or "insight" (middle slides), then "result" (second-to-last), "cta" (final slide).
- Headlines: short, punchy, max 8 words. Use the hook headline to create curiosity or state a bold claim.
- Body text: 1-3 short sentences per slide (max 180 chars). Conversational, not formal.
- key_stat: a single striking number or percentage if the slide content warrants one (e.g. "73%", "3x faster", "$2.4M"). null if no stat.
- The hook slide should tease the article's core insight without giving everything away.
- The CTA slide should invite discussion or sharing — not be salesy.
- Pull real data and examples from the article. Do NOT fabricate statistics.
- Write for a professional audience scanning on mobile."""


async def generate_carousel_slides(
    content_html: str,
    title: str,
) -> tuple[list[CarouselSlide], OpenAIResponse]:
    """Call GPT-4o to structure blog content into carousel slides."""
    from markdownify import markdownify

    # Convert HTML to plain text for the AI
    plain_text = markdownify(content_html, strip=["img", "script"])

    user_prompt = f"""Article title: {title}

Article content:
{plain_text[:8000]}

Structure this into a 5-7 slide LinkedIn carousel. Return ONLY a JSON array."""

    response = await _call_openai(
        system_prompt=SLIDE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        model=MODEL,
        timeout=CAROUSEL_TIMEOUT,
        max_tokens=CAROUSEL_MAX_TOKENS,
        temperature=0.5,
    )

    # Parse JSON from response (strip code fences if present)
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    slides_data = json.loads(text)

    slides = []
    for s in slides_data:
        slides.append(CarouselSlide(
            slide_number=s.get("slide_number", len(slides) + 1),
            slide_type=s.get("type", "insight"),
            headline=s.get("headline", ""),
            body_text=s.get("body_text", ""),
            key_stat=s.get("key_stat"),
        ))

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


def _wrap_text(c, text, font_name, font_size, max_width):
    """Simple word-wrap that returns list of lines."""
    words = text.split()
    lines = []
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

    return lines


def render_carousel_pdf(slides: list[CarouselSlide], branding: dict) -> bytes:
    """Render slides to a branded PDF using ReportLab."""
    _register_fonts()

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
        is_first = idx == 0
        is_last = idx == total_slides - 1

        # --- Background gradient ---
        _draw_gradient(c, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, color_top, color_bottom)

        # --- Top accent bar ---
        c.setFillColor(accent_color)
        c.rect(0, SLIDE_HEIGHT - 8, SLIDE_WIDTH, 8, fill=1, stroke=0)

        # --- Headline ---
        headline_font_size = 52 if is_first else 44
        headline_font = "Cinzel"
        c.setFillColor(text_color)
        c.setFont(headline_font, headline_font_size)

        headline_y = SLIDE_HEIGHT - 160 if is_first else SLIDE_HEIGHT - 140
        headline_lines = _wrap_text(c, slide.headline.upper(), headline_font, headline_font_size, content_width)

        for line_idx, line in enumerate(headline_lines[:3]):  # max 3 lines
            y = headline_y - line_idx * (headline_font_size + 10)
            c.drawString(margin, y, line)

        # --- Accent line below headline ---
        accent_line_y = headline_y - len(headline_lines[:3]) * (headline_font_size + 10) - 15
        c.setFillColor(accent_color)
        c.rect(margin, accent_line_y, 80, 4, fill=1, stroke=0)

        # --- Key stat callout ---
        body_start_y = accent_line_y - 50

        if slide.key_stat:
            c.setFillColor(accent_color)
            stat_font_size = 64
            c.setFont("Inter", stat_font_size)
            c.drawString(margin, body_start_y, slide.key_stat)
            body_start_y -= stat_font_size + 20

        # --- Body text ---
        body_font = "Inter"
        body_font_size = 28
        c.setFillColor(text_color)
        c.setFont(body_font, body_font_size)

        body_lines = _wrap_text(c, slide.body_text, body_font, body_font_size, content_width)
        line_height = body_font_size + 12

        for line_idx, line in enumerate(body_lines[:8]):  # max 8 lines
            y = body_start_y - line_idx * line_height
            c.drawString(margin, y, line)

        # --- Slide counter (bottom-left) ---
        c.setFillColor(Color(
            text_color.red, text_color.green, text_color.blue, alpha=0.5
        ))
        c.setFont("Inter", 20)
        c.drawString(margin, 50, f"{idx + 1} / {total_slides}")

        # --- Swipe indicator (bottom-right, non-final slides) ---
        if not is_last:
            c.setFillColor(accent_color)
            c.setFont("Inter", 22)
            c.drawRightString(SLIDE_WIDTH - margin, 50, "SWIPE >")

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
) -> CarouselResult:
    """Full pipeline: AI slides + resolve branding + render PDF."""
    slides, ai_response = await generate_carousel_slides(content_html, title)
    branding = resolve_branding(template, request_branding)
    pdf_bytes = render_carousel_pdf(slides, branding)

    return CarouselResult(
        pdf_bytes=pdf_bytes,
        slide_count=len(slides),
        prompt_tokens=ai_response.prompt_tokens,
        completion_tokens=ai_response.completion_tokens,
        total_tokens=ai_response.total_tokens,
    )
