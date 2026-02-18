import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.blog_schedule import BlogSchedule
from app.models.prompt_template import PromptTemplate
from app.models.site import Site
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.billing import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    PortalSessionRequest,
    PortalSessionResponse,
    SubscriptionDetail,
    TierInfoResponse,
    TierLimitsResponse,
    UsageResponse,
)
from app.services.tier_limits import TIER_LIMITS, get_effective_tier
from sqlalchemy import func

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/tier-info", response_model=TierInfoResponse)
async def get_tier_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the user's effective tier, limits, current resource usage, and subscription details."""
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

    # Fetch subscription details if user has one
    subscription_detail = None
    if current_user.subscription_tier:
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        sub = sub_result.scalar_one_or_none()
        if sub:
            subscription_detail = SubscriptionDetail(
                status=sub.status,
                current_period_end=sub.current_period_end,
                cancel_at_period_end=sub.cancel_at_period_end,
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
        subscription=subscription_detail,
    )


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for subscribing to a plan."""
    from app.services.stripe_service import create_checkout_session as _create_checkout
    from app.services.stripe_service import create_portal_session as _create_portal

    # If user already has an active subscription, redirect to portal instead
    if current_user.subscription_tier:
        portal_url = await _create_portal(current_user, body.success_url, db)
        return CheckoutSessionResponse(checkout_url=portal_url)

    valid_tiers = ("scriptor", "tribune", "imperator")
    if body.tier not in valid_tiers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tier. Must be one of: {', '.join(valid_tiers)}",
        )

    try:
        url = await _create_checkout(
            user=current_user,
            tier=body.tier,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return CheckoutSessionResponse(checkout_url=url)


@router.post("/create-portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    body: PortalSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    from app.services.stripe_service import create_portal_session as _create_portal

    url = await _create_portal(current_user, body.return_url, db)
    return PortalSessionResponse(portal_url=url)


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events. No auth — verified by Stripe signature."""
    from app.services.stripe_service import handle_webhook_event

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header",
        )

    # Get a fresh DB session for the webhook (not tied to auth)
    from app.core.database import async_session

    async with async_session() as db:
        try:
            event_type = await handle_webhook_event(payload, sig_header, db)
            logger.info("Processed Stripe webhook: %s", event_type)
            return {"status": "ok", "type": event_type}
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
