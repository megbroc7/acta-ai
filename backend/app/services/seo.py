import json
import logging

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


async def suggest_keywords(
    industry: str | None = None,
    topic: str | None = None,
    niche: str | None = None,
    existing_keywords: list[str] | None = None,
) -> dict:
    """Use OpenAI to suggest SEO keywords based on context."""
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    context_parts = []
    if industry:
        context_parts.append(f"Industry: {industry}")
    if topic:
        context_parts.append(f"Topic: {topic}")
    if niche:
        context_parts.append(f"Niche: {niche}")

    context = "\n".join(context_parts) if context_parts else "General blog content"

    avoid_clause = ""
    if existing_keywords:
        avoid_clause = (
            f"\n\nThe user already has these keywords, so suggest DIFFERENT ones: "
            f"{', '.join(existing_keywords)}"
        )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an SEO keyword research specialist. "
                    "Return JSON with exactly two keys:\n"
                    '- "keywords": array of 10-15 relevant SEO keywords/phrases\n'
                    '- "focus_keyword_suggestion": a single best primary keyword\n'
                    "Keywords should be realistic search terms people actually use. "
                    "Mix short-tail and long-tail keywords."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Suggest SEO keywords for the following context:\n\n"
                    f"{context}{avoid_clause}"
                ),
            },
        ],
        temperature=0.7,
        max_tokens=500,
    )

    result = json.loads(response.choices[0].message.content)
    return {
        "keywords": result.get("keywords", []),
        "focus_keyword_suggestion": result.get("focus_keyword_suggestion"),
    }
