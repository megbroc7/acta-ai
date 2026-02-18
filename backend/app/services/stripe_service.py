"""Stripe integration — checkout, portal, and webhook handling."""

import logging
from datetime import datetime, timezone

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

# ---------------------------------------------------------------------------
# Price ID ↔ tier mapping
# ---------------------------------------------------------------------------

_PRICE_TO_TIER: dict[str, str] = {}


def _build_price_map():
    """Build reverse mapping from price IDs to tier names (lazy init)."""
    global _PRICE_TO_TIER
    _PRICE_TO_TIER = {
        settings.STRIPE_PRICE_SCRIPTOR: "scriptor",
        settings.STRIPE_PRICE_TRIBUNE: "tribune",
        settings.STRIPE_PRICE_IMPERATOR: "imperator",
    }
    # Remove empty keys (unconfigured price IDs)
    _PRICE_TO_TIER = {k: v for k, v in _PRICE_TO_TIER.items() if k}


def _price_to_tier(price_id: str) -> str | None:
    if not _PRICE_TO_TIER:
        _build_price_map()
    return _PRICE_TO_TIER.get(price_id)


def _tier_to_price(tier: str) -> str | None:
    mapping = {
        "scriptor": settings.STRIPE_PRICE_SCRIPTOR,
        "tribune": settings.STRIPE_PRICE_TRIBUNE,
        "imperator": settings.STRIPE_PRICE_IMPERATOR,
    }
    return mapping.get(tier) or None


def _from_unix(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


# ---------------------------------------------------------------------------
# Customer management
# ---------------------------------------------------------------------------


async def get_or_create_customer(user: User, db: AsyncSession) -> str:
    """Return the Stripe customer ID, creating one if needed."""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = await stripe.Customer.create_async(
        email=user.email,
        name=user.full_name,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = customer.id
    await db.commit()
    logger.info("Created Stripe customer %s for user %s", customer.id, user.id)
    return customer.id


# ---------------------------------------------------------------------------
# Checkout & Portal
# ---------------------------------------------------------------------------


async def create_checkout_session(
    user: User,
    tier: str,
    success_url: str,
    cancel_url: str,
    db: AsyncSession,
) -> str:
    """Create a Stripe Checkout Session and return its URL."""
    price_id = _tier_to_price(tier)
    if not price_id:
        raise ValueError(f"No Stripe price configured for tier: {tier}")

    customer_id = await get_or_create_customer(user, db)

    session = await stripe.checkout.Session.create_async(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": str(user.id), "tier": tier},
    )
    return session.url


async def create_portal_session(
    user: User,
    return_url: str,
    db: AsyncSession,
) -> str:
    """Create a Stripe Customer Portal session and return its URL."""
    customer_id = await get_or_create_customer(user, db)

    session = await stripe.billing_portal.Session.create_async(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url


# ---------------------------------------------------------------------------
# Webhook handling
# ---------------------------------------------------------------------------


async def handle_webhook_event(
    payload: bytes,
    sig_header: str,
    db: AsyncSession,
) -> str:
    """Verify and dispatch a Stripe webhook event. Returns the event type."""
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        raise ValueError("Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data, db)
    elif event_type == "invoice.payment_failed":
        await _handle_payment_failed(data, db)
    else:
        logger.debug("Unhandled Stripe event: %s", event_type)

    return event_type


async def _handle_checkout_completed(session_data: dict, db: AsyncSession):
    """Handle checkout.session.completed — upsert subscription, update user tier."""
    stripe_subscription_id = session_data.get("subscription")
    stripe_customer_id = session_data.get("customer")
    user_id = session_data.get("metadata", {}).get("user_id")
    tier = session_data.get("metadata", {}).get("tier")

    if not stripe_subscription_id or not user_id:
        logger.warning("Checkout completed missing subscription or user_id metadata")
        return

    # Fetch the full subscription from Stripe for period details
    sub = await stripe.Subscription.retrieve_async(stripe_subscription_id)
    price_id = sub["items"]["data"][0]["price"]["id"] if sub["items"]["data"] else None

    # Resolve tier from metadata or price
    if not tier and price_id:
        tier = _price_to_tier(price_id)
    if not tier:
        logger.error("Could not determine tier for subscription %s", stripe_subscription_id)
        return

    # Upsert subscription row
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        subscription.status = sub.get("status", "active")
        subscription.tier = tier
        subscription.stripe_price_id = price_id
        subscription.current_period_start = _from_unix(sub.get("current_period_start"))
        subscription.current_period_end = _from_unix(sub.get("current_period_end"))
        subscription.cancel_at_period_end = sub.get("cancel_at_period_end", False)
    else:
        subscription = Subscription(
            user_id=user_id,
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
            stripe_price_id=price_id,
            status=sub.get("status", "active"),
            tier=tier,
            current_period_start=_from_unix(sub.get("current_period_start")),
            current_period_end=_from_unix(sub.get("current_period_end")),
            cancel_at_period_end=sub.get("cancel_at_period_end", False),
        )
        db.add(subscription)

    # Update user tier
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.subscription_tier = tier
        # Clear trial since they now have a real subscription
        user.trial_ends_at = None

    await db.commit()
    logger.info("Checkout completed: user=%s tier=%s sub=%s", user_id, tier, stripe_subscription_id)


async def _handle_subscription_updated(sub_data: dict, db: AsyncSession):
    """Handle customer.subscription.updated — sync status, tier, period."""
    stripe_subscription_id = sub_data.get("id")
    price_id = sub_data["items"]["data"][0]["price"]["id"] if sub_data.get("items", {}).get("data") else None
    tier = _price_to_tier(price_id) if price_id else None

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        logger.warning("Subscription.updated for unknown sub: %s", stripe_subscription_id)
        return

    subscription.status = sub_data.get("status", subscription.status)
    subscription.cancel_at_period_end = sub_data.get("cancel_at_period_end", False)
    subscription.current_period_start = _from_unix(sub_data.get("current_period_start"))
    subscription.current_period_end = _from_unix(sub_data.get("current_period_end"))
    if price_id:
        subscription.stripe_price_id = price_id
    if tier:
        subscription.tier = tier

    # Sync user tier (handles plan changes)
    user_result = await db.execute(select(User).where(User.id == subscription.user_id))
    user = user_result.scalar_one_or_none()
    if user and tier:
        user.subscription_tier = tier

    await db.commit()
    logger.info("Subscription updated: sub=%s status=%s tier=%s", stripe_subscription_id, subscription.status, tier)


async def _handle_subscription_deleted(sub_data: dict, db: AsyncSession):
    """Handle customer.subscription.deleted — mark canceled, clear user tier."""
    stripe_subscription_id = sub_data.get("id")

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        logger.warning("Subscription.deleted for unknown sub: %s", stripe_subscription_id)
        return

    subscription.status = "canceled"

    # Clear user's subscription tier
    user_result = await db.execute(select(User).where(User.id == subscription.user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.subscription_tier = None

    await db.commit()
    logger.info("Subscription canceled: sub=%s user=%s", stripe_subscription_id, subscription.user_id)


async def _handle_payment_failed(invoice_data: dict, db: AsyncSession):
    """Handle invoice.payment_failed — mark subscription as past_due."""
    stripe_subscription_id = invoice_data.get("subscription")
    if not stripe_subscription_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.status = "past_due"
        await db.commit()
        logger.warning("Payment failed: sub=%s marked past_due", stripe_subscription_id)
