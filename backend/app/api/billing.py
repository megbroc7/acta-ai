from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.blog_schedule import BlogSchedule
from app.models.prompt_template import PromptTemplate
from app.models.site import Site
from app.models.user import User
from app.schemas.billing import TierInfoResponse, TierLimitsResponse, UsageResponse
from app.services.tier_limits import TIER_LIMITS, get_effective_tier

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/tier-info", response_model=TierInfoResponse)
async def get_tier_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the user's effective tier, limits, and current resource usage."""
    tier = get_effective_tier(current_user)

    # Current usage counts
    site_count = (
        await db.execute(
            select(func.count()).select_from(Site).where(Site.user_id == current_user.id)
        )
    ).scalar() or 0

    template_count = (
        await db.execute(
            select(func.count())
            .select_from(PromptTemplate)
            .where(PromptTemplate.user_id == current_user.id)
        )
    ).scalar() or 0

    schedule_count = (
        await db.execute(
            select(func.count())
            .select_from(BlogSchedule)
            .where(BlogSchedule.user_id == current_user.id)
        )
    ).scalar() or 0

    # Build limits response
    limits = None
    if tier and tier in TIER_LIMITS:
        t = TIER_LIMITS[tier]
        limits = TierLimitsResponse(
            sites=t["sites"],
            templates=t["templates"],
            schedules=t["schedules"],
            image_sources=t["image_sources"],
            review_workflow=t["review_workflow"],
            wp_pending_review=t["wp_pending_review"],
            voice_match=t["voice_match"],
            revise_with_ai=t["revise_with_ai"],
            dalle_quality=t["dalle_quality"],
        )

    trial_active = bool(
        current_user.trial_ends_at
        and current_user.trial_ends_at > datetime.now(timezone.utc)
        and not current_user.subscription_tier
    )

    return TierInfoResponse(
        effective_tier=tier,
        subscription_tier=current_user.subscription_tier,
        trial_ends_at=current_user.trial_ends_at,
        trial_active=trial_active,
        limits=limits,
        usage=UsageResponse(
            sites=site_count,
            templates=template_count,
            schedules=schedule_count,
        ),
    )
