"""Subscription tier definitions and enforcement helpers."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blog_schedule import BlogSchedule
from app.models.prompt_template import PromptTemplate
from app.models.site import Site
from app.models.user import User

# ---------------------------------------------------------------------------
# Tier definitions
# ---------------------------------------------------------------------------

TIER_LIMITS = {
    "scriptor": {
        "sites": 1,
        "templates": 3,
        "schedules": 2,
        "image_sources": ["unsplash"],
        "review_workflow": False,
        "wp_pending_review": False,
        "voice_match": False,
        "revise_with_ai": False,
        "web_research": False,
        "repurpose_linkedin": False,
        "repurpose_youtube_script": False,
        "generate_carousel": False,
        "dalle_quality": None,
    },
    "tribune": {
        "sites": 3,
        "templates": 15,
        "schedules": 10,
        "image_sources": ["unsplash", "dalle"],
        "review_workflow": True,
        "wp_pending_review": False,
        "voice_match": True,
        "revise_with_ai": True,
        "web_research": True,
        "repurpose_linkedin": True,
        "repurpose_youtube_script": True,
        "generate_carousel": True,
        "dalle_quality": "standard",
    },
    "imperator": {
        "sites": 10,
        "templates": None,  # unlimited
        "schedules": None,  # unlimited
        "image_sources": ["unsplash", "dalle"],
        "review_workflow": True,
        "wp_pending_review": True,
        "voice_match": True,
        "revise_with_ai": True,
        "web_research": True,
        "repurpose_linkedin": True,
        "repurpose_youtube_script": True,
        "generate_carousel": True,
        "dalle_quality": "hd",
    },
}

TIER_NAMES = {"scriptor": "Scriptor", "tribune": "Tribune", "imperator": "Imperator"}

# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------


def get_effective_tier(user: User) -> str | None:
    """Return the user's active tier, factoring in trial period.

    Priority:
    1. Explicit subscription_tier (set by Stripe webhook or admin)
    2. Active trial → "tribune" level access
    3. None (no access — soft-locked)
    """
    if user.subscription_tier:
        return user.subscription_tier

    # Check trial
    if user.trial_ends_at and user.trial_ends_at > datetime.now(timezone.utc):
        return "tribune"

    return None


def get_tier_limits(user: User) -> dict | None:
    """Return the limits dict for the user's effective tier, or None."""
    tier = get_effective_tier(user)
    if tier is None:
        return None
    return TIER_LIMITS.get(tier)


# ---------------------------------------------------------------------------
# Enforcement: resource limits
# ---------------------------------------------------------------------------


def _raise_limit(resource: str, limit: int, tier: str):
    """Raise a 403 with a descriptive upgrade message."""
    tier_display = TIER_NAMES.get(tier, tier)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            f"Your {tier_display} plan allows up to {limit} {resource}. "
            f"Upgrade your subscription to add more."
        ),
    )


def _raise_no_subscription():
    """Raise a 403 for users with no active subscription or trial."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "Your free trial has ended. Subscribe to a plan to continue "
            "creating content and managing your sites."
        ),
    )


async def require_active_subscription(user: User):
    """Raise 403 if the user has no effective tier (expired trial, no subscription)."""
    if get_effective_tier(user) is None:
        _raise_no_subscription()


async def check_site_limit(db: AsyncSession, user: User):
    """Raise 403 if user is at their site limit."""
    tier = get_effective_tier(user)
    if tier is None:
        _raise_no_subscription()

    limits = TIER_LIMITS[tier]
    max_sites = limits["sites"]
    if max_sites is None:
        return  # unlimited

    count_result = await db.execute(
        select(func.count()).select_from(Site).where(Site.user_id == user.id)
    )
    current_count = count_result.scalar() or 0

    if current_count >= max_sites:
        _raise_limit("sites", max_sites, tier)


async def check_template_limit(db: AsyncSession, user: User):
    """Raise 403 if user is at their template limit."""
    tier = get_effective_tier(user)
    if tier is None:
        _raise_no_subscription()

    limits = TIER_LIMITS[tier]
    max_templates = limits["templates"]
    if max_templates is None:
        return  # unlimited

    count_result = await db.execute(
        select(func.count())
        .select_from(PromptTemplate)
        .where(PromptTemplate.user_id == user.id)
    )
    current_count = count_result.scalar() or 0

    if current_count >= max_templates:
        _raise_limit("templates", max_templates, tier)


async def check_schedule_limit(db: AsyncSession, user: User):
    """Raise 403 if user is at their schedule limit."""
    tier = get_effective_tier(user)
    if tier is None:
        _raise_no_subscription()

    limits = TIER_LIMITS[tier]
    max_schedules = limits["schedules"]
    if max_schedules is None:
        return  # unlimited

    count_result = await db.execute(
        select(func.count())
        .select_from(BlogSchedule)
        .where(BlogSchedule.user_id == user.id)
    )
    current_count = count_result.scalar() or 0

    if current_count >= max_schedules:
        _raise_limit("schedules", max_schedules, tier)


# ---------------------------------------------------------------------------
# Enforcement: feature gates
# ---------------------------------------------------------------------------


def check_feature_access(user: User, feature: str):
    """Raise 403 if the user's tier doesn't include the given boolean feature.

    Valid features: review_workflow, wp_pending_review, voice_match, revise_with_ai
    """
    tier = get_effective_tier(user)
    if tier is None:
        _raise_no_subscription()

    limits = TIER_LIMITS[tier]
    if not limits.get(feature, False):
        tier_display = TIER_NAMES.get(tier, tier)
        feature_labels = {
            "review_workflow": "Review Queue workflow",
            "wp_pending_review": "WordPress Pending Review status",
            "voice_match": "Match My Writing Style",
            "revise_with_ai": "Revise with AI",
            "web_research": "Web Research",
            "repurpose_linkedin": "Repurpose to LinkedIn",
            "repurpose_youtube_script": "YouTube Script",
            "generate_carousel": "LinkedIn Carousel",
        }
        label = feature_labels.get(feature, feature)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"{label} is not available on your {tier_display} plan. "
                f"Upgrade to access this feature."
            ),
        )


def check_image_source(user: User, source: str | None):
    """Validate that the user's tier allows the requested image source.

    source: "none", "dalle", "unsplash", or None
    """
    if not source or source == "none":
        return  # always allowed

    tier = get_effective_tier(user)
    if tier is None:
        _raise_no_subscription()

    limits = TIER_LIMITS[tier]
    allowed = limits.get("image_sources", [])

    if source not in allowed:
        tier_display = TIER_NAMES.get(tier, tier)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"DALL-E image generation is not available on your {tier_display} plan. "
                f"Upgrade to use AI-generated featured images."
            ),
        )
