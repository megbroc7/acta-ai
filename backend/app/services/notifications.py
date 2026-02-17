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
