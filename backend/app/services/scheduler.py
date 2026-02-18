"""APScheduler scheduling engine.

Manages cron-based jobs that generate AI content and optionally auto-publish.
Uses AsyncIOScheduler with in-memory job store, rebuilt from DB on startup.
"""

import logging
import time
import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.database import async_session
from app.models.app_settings import AppSettings
from app.models.blog_post import BlogPost, ExecutionHistory
from app.models.blog_schedule import BlogSchedule
from app.models.user import User
from app.services import content as content_service
from app.services import publishing as publishing_service
from app.services.content import GPT4O_INPUT_COST, GPT4O_OUTPUT_COST, DALLE3_COST, DALLE3_HD_COST, WEB_SEARCH_COST
from app.services.error_classifier import classify_error
from app.services.notifications import (
    create_deactivation_notification,
    create_failure_notification,
    create_publish_failure_notification,
    create_subscription_expired_notification,
    create_trial_expiry_notification,
)
from app.services.publishing import PublishError
from app.services.tier_limits import TIER_LIMITS, get_effective_tier

logger = logging.getLogger(__name__)

MAX_RETRY_COUNT = 3

scheduler = AsyncIOScheduler(
    job_defaults={
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 3600,
    }
)


# ---------------------------------------------------------------------------
# Trigger builder
# ---------------------------------------------------------------------------

def build_trigger(schedule: BlogSchedule) -> CronTrigger:
    """Map a BlogSchedule's frequency settings to an APScheduler CronTrigger."""
    hour, minute = schedule.time_of_day.split(":")
    tz = schedule.timezone or "UTC"

    if schedule.frequency == "daily":
        return CronTrigger(hour=int(hour), minute=int(minute), timezone=tz)

    if schedule.frequency == "weekly":
        return CronTrigger(
            day_of_week=schedule.day_of_week or 0,
            hour=int(hour),
            minute=int(minute),
            timezone=tz,
        )

    if schedule.frequency == "monthly":
        return CronTrigger(
            day=schedule.day_of_month or 1,
            hour=int(hour),
            minute=int(minute),
            timezone=tz,
        )

    if schedule.frequency == "custom" and schedule.custom_cron:
        return CronTrigger.from_crontab(schedule.custom_cron, timezone=tz)

    # Fallback: treat as daily
    logger.warning("Unknown frequency '%s' for schedule %s — defaulting to daily", schedule.frequency, schedule.id)
    return CronTrigger(hour=int(hour), minute=int(minute), timezone=tz)


# ---------------------------------------------------------------------------
# Next-run computation
# ---------------------------------------------------------------------------

def _compute_next_run(schedule: BlogSchedule) -> datetime | None:
    """Compute the next fire time for a schedule using its trigger."""
    try:
        trigger = build_trigger(schedule)
        now = datetime.now(timezone.utc)
        next_fire = trigger.get_next_fire_time(None, now)
        return next_fire
    except Exception:
        logger.exception("Failed to compute next_run for schedule %s", schedule.id)
        return None


# ---------------------------------------------------------------------------
# Core execution pipeline
# ---------------------------------------------------------------------------

async def execute_schedule(schedule_id: uuid.UUID, execution_type: str = "scheduled") -> dict:
    """Generate content for a schedule, optionally publish, and log execution.

    Creates its own DB session — safe to call from APScheduler or manually.
    Returns a dict with execution result info.
    """
    start = time.monotonic()
    result = {"schedule_id": str(schedule_id), "execution_type": execution_type, "success": False}

    async with async_session() as db:
        # 0. Maintenance mode guard — skip silently (no ExecutionHistory)
        maint_row = await db.execute(
            select(AppSettings.maintenance_mode).where(AppSettings.id == 1)
        )
        if maint_row.scalar_one_or_none():
            logger.warning(
                "Maintenance mode active — skipping schedule %s", schedule_id
            )
            result["error_message"] = "Skipped: maintenance mode"
            return result

        # 1. Load schedule with relationships
        stmt = (
            select(BlogSchedule)
            .where(BlogSchedule.id == schedule_id)
            .options(
                selectinload(BlogSchedule.site),
                selectinload(BlogSchedule.prompt_template),
            )
        )
        row = await db.execute(stmt)
        schedule = row.scalar_one_or_none()

        if not schedule:
            result["error_message"] = "Schedule not found"
            logger.error("execute_schedule: schedule %s not found", schedule_id)
            return result

        # 1.5. Subscription guard — block if user has no active tier
        user_row = await db.execute(
            select(User).where(User.id == schedule.user_id)
        )
        schedule_user = user_row.scalar_one_or_none()
        user_dalle_quality = "standard"
        if schedule_user:
            tier = get_effective_tier(schedule_user)
            if tier is None:
                logger.warning(
                    "Subscription expired for user %s — auto-deactivating schedule '%s'",
                    schedule_user.email, schedule.name,
                )
                schedule.is_active = False
                schedule.next_run = None
                remove_schedule_job(schedule.id)
                await create_subscription_expired_notification(db, schedule)
                await db.commit()
                result["error_message"] = "Subscription expired — schedule deactivated"
                return result
            # Look up tier-specific DALL-E quality
            tier_limits = TIER_LIMITS.get(tier, {})
            user_dalle_quality = tier_limits.get("dalle_quality") or "standard"

        # 2. Validate
        if not schedule.is_active:
            result["error_message"] = "Schedule is not active"
            logger.warning("execute_schedule: schedule %s is not active", schedule_id)
            return result

        # 2.5 Skip guard — check if today is in skipped_dates
        tz = ZoneInfo(schedule.timezone or "UTC")
        today_str = datetime.now(tz).strftime("%Y-%m-%d")
        skipped = list(schedule.skipped_dates or [])
        if today_str in skipped:
            logger.info(
                "Schedule '%s' (id=%s) skipped for %s",
                schedule.name, schedule.id, today_str,
            )
            # Prune past dates from skipped_dates
            today_date = date.today()
            pruned = [d for d in skipped if d >= today_str]
            if len(pruned) != len(skipped):
                schedule.skipped_dates = pruned
            # Update next_run and return — no execution, no history
            schedule.next_run = _compute_next_run(schedule)
            await db.commit()
            result["error_message"] = f"Skipped for {today_str}"
            return result

        # Prune any past dates from skipped_dates on every execution
        if skipped:
            pruned = [d for d in skipped if d >= today_str]
            if len(pruned) != len(skipped):
                schedule.skipped_dates = pruned

        if not schedule.site or not schedule.site.is_active:
            result["error_message"] = "Site is not active or missing"
            logger.warning("execute_schedule: site not active for schedule %s", schedule_id)
            await _record_failure(db, schedule, result["error_message"], execution_type, start)
            return result

        if not schedule.prompt_template:
            result["error_message"] = "Prompt template not found"
            logger.warning("execute_schedule: template missing for schedule %s", schedule_id)
            await _record_failure(db, schedule, result["error_message"], execution_type, start)
            return result

        template = schedule.prompt_template
        site = schedule.site

        # 3. Pick topic — round-robin by successful execution count
        topics = schedule.topics or []
        if not topics:
            result["error_message"] = "No topics configured"
            await _record_failure(db, schedule, result["error_message"], execution_type, start)
            return result

        success_count_result = await db.execute(
            select(func.count())
            .select_from(ExecutionHistory)
            .where(
                ExecutionHistory.schedule_id == schedule_id,
                ExecutionHistory.success.is_(True),
            )
        )
        success_count = success_count_result.scalar() or 0
        topic_item = topics[success_count % len(topics)]

        # Support structured topics {"topic": "...", "experience": "..."}
        # and legacy plain strings
        if isinstance(topic_item, dict):
            topic = topic_item.get("topic", "")
            topic_experience = topic_item.get("experience") or ""
        else:
            topic = str(topic_item)
            topic_experience = ""

        # Build combined experience context: template notes + per-topic experience
        experience_parts = []
        if template.experience_notes and template.experience_notes.strip():
            experience_parts.append(template.experience_notes.strip())
        if topic_experience.strip():
            experience_parts.append(topic_experience.strip())
        experience_context = "\n\n".join(experience_parts) if experience_parts else None

        logger.info(
            "Executing schedule '%s' (id=%s) — topic: '%s' [%s]",
            schedule.name, schedule.id, topic, execution_type,
        )

        # 3.5. Fetch last 20 post titles for deduplication
        recent_titles_result = await db.execute(
            select(BlogPost.title)
            .where(BlogPost.schedule_id == schedule_id)
            .order_by(BlogPost.created_at.desc())
            .limit(20)
        )
        existing_titles = [row[0] for row in recent_titles_result.all() if row[0]]

        # 4. Generate content
        try:
            gen = await content_service.generate_post(
                template=template,
                topic=topic,
                word_count=schedule.word_count,
                tone=schedule.tone,
                replacements=schedule.prompt_replacements or {},
                experience_context=experience_context,
                existing_titles=existing_titles,
                dalle_quality=user_dalle_quality,
            )
        except Exception as e:
            error_msg = f"Content generation failed: {e}"
            logger.exception("Content generation failed for schedule %s", schedule_id)
            await _record_failure(db, schedule, error_msg, execution_type, start)
            result["error_message"] = error_msg
            return result

        # 5. Create BlogPost
        # Store outline in the content_prompt_used audit field (no DB migration needed)
        audit_content_prompt = (
            f"--- OUTLINE ---\n{gen.outline_used}\n\n"
            f"--- CONTENT PROMPT ---\n{gen.content_prompt_used}"
        )
        post = BlogPost(
            user_id=schedule.user_id,
            site_id=schedule.site_id,
            schedule_id=schedule.id,
            prompt_template_id=schedule.prompt_template_id,
            title=gen.title,
            content=gen.content_html,
            excerpt=gen.excerpt,
            featured_image_url=gen.featured_image_url,
            meta_title=gen.meta_title,
            meta_description=gen.meta_description,
            image_alt_text=gen.image_alt_text,
            categories=schedule.category_ids or [],
            tags=schedule.tag_ids or [],
            system_prompt_used=gen.system_prompt_used,
            topic_prompt_used=gen.topic_prompt_used,
            content_prompt_used=audit_content_prompt,
        )

        # 6/7. Set post status based on schedule.post_status
        target_status = (schedule.post_status or "draft").lower()

        if target_status == "publish":
            try:
                pub_result = await publishing_service.publish_post(post, site)
                post.status = "published"
                post.platform_post_id = pub_result.platform_post_id
                post.published_url = pub_result.published_url
                post.published_at = datetime.now(timezone.utc)
                logger.info("Post published: %s", pub_result.published_url)
            except PublishError as e:
                # Publish failed — save as draft, content not lost
                post.status = "draft"
                error_msg = f"Publishing failed: {e}"
                logger.error("Publishing failed for schedule %s: %s", schedule_id, e)
                db.add(post)
                await db.flush()
                await create_publish_failure_notification(db, schedule, post, error_msg)
                await _record_failure(db, schedule, error_msg, execution_type, start, post_id=post.id)
                result["error_message"] = error_msg
                return result
        elif target_status == "pending_review":
            post.status = "pending_review"
        else:
            post.status = "draft"

        db.add(post)
        await db.flush()

        # 9. Log successful execution with cost data
        duration_ms = int((time.monotonic() - start) * 1000)
        est_cost = (
            gen.prompt_tokens * GPT4O_INPUT_COST
            + gen.completion_tokens * GPT4O_OUTPUT_COST
        )
        if template.image_source == "dalle":
            img_cost = DALLE3_HD_COST if user_dalle_quality == "hd" else DALLE3_COST
        else:
            img_cost = 0.0
        if template.web_research_enabled:
            est_cost += WEB_SEARCH_COST
        execution = ExecutionHistory(
            schedule_id=schedule.id,
            user_id=schedule.user_id,
            post_id=post.id,
            execution_type=execution_type,
            duration_ms=duration_ms,
            success=True,
            prompt_tokens=gen.prompt_tokens,
            completion_tokens=gen.completion_tokens,
            total_tokens=gen.total_tokens,
            estimated_cost_usd=round(est_cost, 6),
            image_cost_usd=img_cost,
        )
        db.add(execution)

        # 10. Update schedule state
        schedule.last_run = datetime.now(timezone.utc)
        schedule.retry_count = 0
        schedule.next_run = _compute_next_run(schedule)

        await db.commit()

        result["success"] = True
        result["post_id"] = str(post.id)
        result["title"] = post.title
        result["status"] = post.status
        result["duration_ms"] = duration_ms
        if post.published_url:
            result["published_url"] = post.published_url

        logger.info(
            "Schedule '%s' executed successfully — post '%s' (%s) in %dms",
            schedule.name, post.title, post.status, duration_ms,
        )
        return result


async def _record_failure(
    db,
    schedule: BlogSchedule,
    error_message: str,
    execution_type: str,
    start: float,
    post_id: uuid.UUID | None = None,
):
    """Record a failed execution and handle retry count / auto-deactivation."""
    duration_ms = int((time.monotonic() - start) * 1000)

    error_category = classify_error(error_message)

    execution = ExecutionHistory(
        schedule_id=schedule.id,
        user_id=schedule.user_id,
        post_id=post_id,
        execution_type=execution_type,
        duration_ms=duration_ms,
        success=False,
        error_message=error_message,
        error_category=error_category,
    )
    db.add(execution)
    await db.flush()  # need execution.id for notification FK

    # Create failure notification
    await create_failure_notification(db, schedule, execution, error_category, error_message)

    schedule.last_run = datetime.now(timezone.utc)
    schedule.retry_count = (schedule.retry_count or 0) + 1

    # 11. Auto-deactivate after MAX_RETRY_COUNT consecutive failures
    if schedule.retry_count >= MAX_RETRY_COUNT:
        schedule.is_active = False
        schedule.next_run = None
        remove_schedule_job(schedule.id)
        logger.warning(
            "Schedule '%s' (id=%s) auto-deactivated after %d consecutive failures",
            schedule.name, schedule.id, schedule.retry_count,
        )
        await create_deactivation_notification(db, schedule)
    else:
        schedule.next_run = _compute_next_run(schedule)

    await db.commit()


# ---------------------------------------------------------------------------
# Job management
# ---------------------------------------------------------------------------

def _job_id(schedule_id: uuid.UUID) -> str:
    return f"schedule_{schedule_id}"


def add_schedule_job(schedule: BlogSchedule) -> None:
    """Add or replace an APScheduler job for the given schedule."""
    trigger = build_trigger(schedule)
    scheduler.add_job(
        execute_schedule,
        trigger=trigger,
        id=_job_id(schedule.id),
        args=[schedule.id],
        kwargs={"execution_type": "scheduled"},
        replace_existing=True,
        name=f"schedule:{schedule.name}",
    )
    logger.info("Scheduler job added/updated for schedule '%s' (id=%s)", schedule.name, schedule.id)


def remove_schedule_job(schedule_id: uuid.UUID) -> None:
    """Remove a job from the scheduler if it exists."""
    job_id = _job_id(schedule_id)
    try:
        scheduler.remove_job(job_id)
        logger.info("Scheduler job removed: %s", job_id)
    except Exception:
        # Job doesn't exist — that's fine
        pass


async def trigger_schedule_now(schedule_id: uuid.UUID) -> dict:
    """Execute a schedule immediately (manual trigger)."""
    return await execute_schedule(schedule_id, execution_type="manual")


# ---------------------------------------------------------------------------
# Trial expiry checker
# ---------------------------------------------------------------------------

async def check_trial_expirations() -> None:
    """Check for users approaching trial expiry and create notifications.

    Runs daily — checks for 3 days, 1 day, and 0 days remaining.
    Deduplicates by checking for existing notifications with the same title today.
    """
    from app.models.notification import Notification

    async with async_session() as db:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Users on trial (no subscription_tier, trial_ends_at set)
        result = await db.execute(
            select(User).where(
                User.trial_ends_at.isnot(None),
                User.subscription_tier.is_(None),
            )
        )
        trial_users = result.scalars().all()

        created = 0
        for user in trial_users:
            days_remaining = (user.trial_ends_at - now).days

            if days_remaining not in (3, 1, 0):
                continue

            # Build expected title for dedup check
            if days_remaining == 3:
                expected_title = "Your trial ends in 3 days"
            elif days_remaining == 1:
                expected_title = "Your trial ends tomorrow"
            else:
                expected_title = "Your free trial has ended"

            # Check if we already sent this notification today
            existing = await db.execute(
                select(func.count(Notification.id)).where(
                    Notification.user_id == user.id,
                    Notification.category == "billing",
                    Notification.title == expected_title,
                    Notification.created_at >= today_start,
                )
            )
            if (existing.scalar() or 0) > 0:
                continue

            await create_trial_expiry_notification(db, user, days_remaining)
            created += 1

        if created:
            await db.commit()
            logger.info("Created %d trial expiry notification(s)", created)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

async def start_scheduler() -> None:
    """Load all active schedules from DB, add jobs, and start the scheduler."""
    async with async_session() as db:
        result = await db.execute(
            select(BlogSchedule).where(BlogSchedule.is_active.is_(True))
        )
        active_schedules = result.scalars().all()

        for schedule in active_schedules:
            try:
                add_schedule_job(schedule)
                # Update next_run while we're at it
                schedule.next_run = _compute_next_run(schedule)
            except Exception:
                logger.exception("Failed to add job for schedule %s", schedule.id)

        await db.commit()

    # Run trial expiry check on startup
    try:
        await check_trial_expirations()
    except Exception:
        logger.exception("Trial expiry check failed on startup")

    # Add daily trial expiry check job (runs at 09:00 UTC)
    scheduler.add_job(
        check_trial_expirations,
        CronTrigger(hour=9, minute=0, timezone="UTC"),
        id="trial_expiry_check",
        name="Daily trial expiry check",
        replace_existing=True,
    )

    scheduler.start()
    job_count = len(scheduler.get_jobs())
    logger.info("Scheduler started with %d active job(s)", job_count)


async def stop_scheduler() -> None:
    """Shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

def get_scheduler_status() -> dict:
    """Return scheduler running state and job list for health checks."""
    jobs = []
    if scheduler.running:
        for job in scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            })
    return {
        "running": scheduler.running,
        "job_count": len(jobs),
        "jobs": jobs,
    }
