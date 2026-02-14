"""Featured image generation service.

Supports two sources:
- DALL-E 3: AI-generated images via OpenAI
- Unsplash: Stock photo search via Unsplash API

All functions are non-fatal — they log errors and return None so the
article pipeline continues even if image generation fails.
"""

import logging

import httpx
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


async def generate_featured_image(
    source: str,
    title: str,
    industry: str | None = None,
    style_guidance: str | None = None,
) -> str | None:
    """Dispatch to the correct image source. Returns image URL or None."""
    if not source or source == "none":
        return None

    if source == "dalle":
        return await _generate_dalle_image(title, industry, style_guidance)
    if source == "unsplash":
        return await _search_unsplash_image(title, industry)

    logger.warning("Unknown image source: %s", source)
    return None


async def _generate_dalle_image(
    title: str,
    industry: str | None = None,
    style_guidance: str | None = None,
) -> str | None:
    """Generate a featured image with DALL-E 3."""
    if not settings.OPENAI_API_KEY:
        logger.warning("DALL-E image generation skipped: no OpenAI API key")
        return None

    # Build prompt
    parts = [
        f"A professional blog header image for an article titled: \"{title}\".",
    ]
    if industry:
        parts.append(f"Industry/topic: {industry}.")
    if style_guidance:
        parts.append(f"Style: {style_guidance}.")
    parts.append("No text overlaid on the image. Clean, editorial, high quality.")
    prompt = " ".join(parts)

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=60)
        response = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="standard",
            n=1,
        )
        url = response.data[0].url
        logger.info("DALL-E image generated for '%s'", title)
        return url
    except Exception as e:
        logger.error("DALL-E image generation failed: %s", e)
        return None


async def _search_unsplash_image(
    title: str,
    industry: str | None = None,
) -> str | None:
    """Search Unsplash for a relevant stock photo."""
    if not settings.UNSPLASH_ACCESS_KEY:
        logger.warning("Unsplash image search skipped: no access key")
        return None

    headers = {"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try title-based search first
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                headers=headers,
                params={
                    "query": title,
                    "orientation": "landscape",
                    "per_page": 5,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])

            # Fall back to industry if title search yields <2 results
            if len(results) < 2 and industry:
                resp = await client.get(
                    "https://api.unsplash.com/search/photos",
                    headers=headers,
                    params={
                        "query": industry,
                        "orientation": "landscape",
                        "per_page": 5,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])

            if not results:
                logger.info("Unsplash: no results for '%s'", title)
                return None

            photo = results[0]
            image_url = photo["urls"]["regular"]

            # Trigger download tracking per Unsplash API guidelines
            download_url = photo.get("links", {}).get("download_location")
            if download_url:
                try:
                    await client.get(download_url, headers=headers)
                except Exception:
                    pass  # Non-critical

            logger.info("Unsplash image found for '%s'", title)
            return image_url
    except Exception as e:
        logger.error("Unsplash image search failed: %s", e)
        return None
