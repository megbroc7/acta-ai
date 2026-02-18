"""Notification creation helpers for schedule execution events."""

import logging

from app.models.notification import Notification
from app.services.error_classifier import get_guidance

logger = logging.getLogger(__name__)


async def create_failure_notification(db, schedule, execution, error_category, error_message):
    """Create a notification for a schedule execution failure."""
    guidance = get_guidance(error_category)
    msg = f"{guidance.user_guidance}"
    if error_message:
        # Truncate raw error for the notification
        short_error = error_message[:200] + ("..." if len(error_message) > 200 else "")
        msg += f"\n\nError: {short_error}"

    notification = Notification(
        user_id=schedule.user_id,
        category=error_category,
        title=f"{guidance.user_title} — {schedule.name}",
        message=msg,
        action_url=f"/schedules/{schedule.id}/edit",
        action_label="Edit Schedule",
        schedule_id=schedule.id,
        execution_id=execution.id,
    )
    db.add(notification)
    logger.info(
        "Created failure notification for schedule '%s' (category=%s)",
        schedule.name, error_category,
    )


async def create_deactivation_notification(db, schedule):
    """Create an urgent notification when a schedule is auto-paused."""
    notification = Notification(
        user_id=schedule.user_id,
        category="config_error",
        title=f"Schedule Paused — {schedule.name}",
        message=(
            f"Schedule '{schedule.name}' was automatically paused after 3 consecutive failures. "
            "Review the error log and fix the issue, then re-activate the schedule."
        ),
        action_url=f"/schedules/{schedule.id}/edit",
        action_label="Edit Schedule",
        schedule_id=schedule.id,
    )
    db.add(notification)
    logger.warning(
        "Created deactivation notification for schedule '%s'", schedule.name,
    )


async def create_subscription_expired_notification(db, schedule):
    """Create a notification when a schedule is auto-paused due to expired subscription."""
    notification = Notification(
        user_id=schedule.user_id,
        category="billing",
        title=f"Schedule Paused — Subscription Required",
        message=(
            f"Schedule '{schedule.name}' was automatically paused because your "
            "free trial has ended and no active subscription was found. "
            "Subscribe to a plan to resume scheduled content generation."
        ),
        action_url="/settings",
        action_label="View Plans",
        schedule_id=schedule.id,
    )
    db.add(notification)
    logger.warning(
        "Created subscription-expired notification for schedule '%s'", schedule.name,
    )


async def create_trial_expiry_notification(db, user, days_remaining):
    """Create a notification warning about trial expiration.

    days_remaining: 3, 1, or 0 (expired).
    """
    if days_remaining == 3:
        title = "Your trial ends in 3 days"
        message = (
            "Your free trial ends in 3 days. Subscribe now to keep your "
            "schedules running and continue generating content."
        )
    elif days_remaining == 1:
        title = "Your trial ends tomorrow"
        message = (
            "Your free trial ends tomorrow. Subscribe to avoid interruption — "
            "active schedules will be paused when the trial expires."
        )
    else:
        title = "Your free trial has ended"
        message = (
            "Your free trial has ended. Active schedules have been paused. "
            "Subscribe to a plan to resume content generation."
        )

    notification = Notification(
        user_id=user.id,
        category="billing",
        title=title,
        message=message,
        action_url="/settings",
        action_label="View Plans",
    )
    db.add(notification)
    logger.info(
        "Created trial expiry notification for user '%s' (days_remaining=%d)",
        user.email, days_remaining,
    )


async def create_publish_failure_notification(db, schedule, post, error_message):
    """Create a notification when publishing fails but the post was saved as draft."""
    short_title = post.title[:100] + ("..." if len(post.title) > 100 else "")
    notification = Notification(
        user_id=schedule.user_id,
        category="publish_auth",
        title=f"Publishing Failed — {short_title}",
        message=(
            f"Publishing failed for '{post.title}'. "
            "The post was saved as a draft — you can publish it manually.\n\n"
            f"Error: {error_message[:200]}"
        ),
        action_url=f"/posts/{post.id}",
        action_label="View Post",
        schedule_id=schedule.id,
    )
    db.add(notification)
    logger.info(
        "Created publish failure notification for post '%s'", post.title,
    )
