from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.services.maintenance import is_maintenance_mode
from app.models.blog_post import BlogPost, ExecutionHistory
from app.models.blog_schedule import BlogSchedule
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.schemas.schedules import (
    AttentionScheduleResponse,
    CalendarEvent,
    CalendarResponse,
    ExecutionHistoryResponse,
    PaginatedExecutionResponse,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
    SkipDateRequest,
    SkipDateResponse,
)
from app.services.error_classifier import get_guidance
from app.services.scheduler import (
    _compute_next_run,
    add_schedule_job,
    build_trigger,
    remove_schedule_job,
    trigger_schedule_now,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])


async def _validate_template_experience(db: AsyncSession, template_id) -> None:
    """Ensure the template's experience_notes is populated before activating a schedule."""
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.experience_notes or not template.experience_notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot activate schedule: template's Experience Notes field is empty. "
                "Edit the template to add your expertise and real-world experience."
            ),
        )


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.tier_limits import check_feature_access, check_schedule_limit

    await check_schedule_limit(db, current_user)

    # Review workflow gate: pending_review requires review_workflow feature
    if data.post_status == "pending_review":
        check_feature_access(current_user, "review_workflow")

    schedule = BlogSchedule(user_id=current_user.id, **data.model_dump())
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Sync scheduler
    if schedule.is_active:
        add_schedule_job(schedule)
        schedule.next_run = _compute_next_run(schedule)
        await db.commit()

    # Re-query with relationships
    result = await db.execute(
        select(BlogSchedule)
        .where(BlogSchedule.id == schedule.id)
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    return result.scalar_one()


@router.get("/", response_model=list[ScheduleResponse])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogSchedule)
        .where(BlogSchedule.user_id == current_user.id)
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    return result.scalars().all()


@router.get("/calendar", response_model=CalendarResponse)
async def get_calendar(
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return calendar events (posts + predicted schedule runs) for a date range."""
    # Validate range — max 62 days
    delta = (end - start).days
    if delta < 0:
        raise HTTPException(status_code=400, detail="end must be after start")
    if delta > 62:
        raise HTTPException(status_code=400, detail="Date range must not exceed 62 days")

    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_dt = datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=timezone.utc)
    events: list[CalendarEvent] = []

    # 1. Query posts within range
    post_result = await db.execute(
        select(BlogPost)
        .where(
            BlogPost.user_id == current_user.id,
            BlogPost.created_at >= start_dt,
            BlogPost.created_at <= end_dt,
        )
        .options(selectinload(BlogPost.site))
    )
    posts = post_result.scalars().all()

    for post in posts:
        events.append(CalendarEvent(
            date=post.created_at,
            event_type="post",
            schedule_id=post.schedule_id,
            site_name=post.site.name if post.site else None,
            site_platform=post.site.platform if post.site else None,
            post_id=post.id,
            title=post.title,
            status=post.status,
        ))

    # 2. Query active schedules with relationships
    sched_result = await db.execute(
        select(BlogSchedule)
        .where(
            BlogSchedule.user_id == current_user.id,
            BlogSchedule.is_active.is_(True),
        )
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    schedules = sched_result.scalars().all()

    for schedule in schedules:
        # Get success count for topic round-robin prediction
        success_count_result = await db.execute(
            select(func.count())
            .select_from(ExecutionHistory)
            .where(
                ExecutionHistory.schedule_id == schedule.id,
                ExecutionHistory.success.is_(True),
            )
        )
        success_count = success_count_result.scalar() or 0

        topics = schedule.topics or []
        if not topics:
            continue

        # Build set of skipped dates for fast lookup
        skipped_set = set(schedule.skipped_dates or [])

        # Walk fire times within range
        try:
            trigger = build_trigger(schedule)
        except Exception:
            continue

        now = datetime.now(timezone.utc)
        current_fire = trigger.get_next_fire_time(None, start_dt)
        safety_count = 0  # total iterations (past + future) — for loop safety
        future_offset = 0  # only counts future events — for topic prediction
        while current_fire and current_fire <= end_dt and safety_count < 100:
            # Only include future predicted runs (past are covered by posts)
            if current_fire > now:
                fire_date_str = current_fire.strftime("%Y-%m-%d")
                is_skipped = fire_date_str in skipped_set

                # Predict topic via round-robin
                topic_idx = (success_count + future_offset) % len(topics)
                topic_item = topics[topic_idx]
                if isinstance(topic_item, dict):
                    predicted_topic = topic_item.get("topic", "")
                else:
                    predicted_topic = str(topic_item)

                events.append(CalendarEvent(
                    date=current_fire,
                    event_type="scheduled",
                    schedule_id=schedule.id,
                    schedule_name=schedule.name,
                    frequency=schedule.frequency,
                    site_name=schedule.site.name if schedule.site else None,
                    site_platform=schedule.site.platform if schedule.site else None,
                    template_name=schedule.prompt_template.name if schedule.prompt_template else None,
                    predicted_topic=predicted_topic,
                    is_skipped=is_skipped,
                ))
                # Only advance topic offset for non-skipped events
                if not is_skipped:
                    future_offset += 1

            safety_count += 1
            current_fire = trigger.get_next_fire_time(current_fire, current_fire)

    # Sort by date
    events.sort(key=lambda e: e.date)

    return CalendarResponse(events=events, start=start, end=end)


@router.get("/attention", response_model=list[AttentionScheduleResponse])
async def get_attention_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get schedules with retry_count > 0 — joined with most recent failed execution."""
    from app.models.site import Site

    # Subquery: most recent failed execution per schedule
    latest_fail_sub = (
        select(
            ExecutionHistory.schedule_id,
            func.max(ExecutionHistory.execution_time).label("max_time"),
        )
        .where(ExecutionHistory.success == False)
        .group_by(ExecutionHistory.schedule_id)
        .subquery()
    )

    rows = await db.execute(
        select(
            BlogSchedule.id,
            BlogSchedule.name,
            BlogSchedule.is_active,
            BlogSchedule.retry_count,
            BlogSchedule.site_id,
            Site.name.label("site_name"),
            ExecutionHistory.error_message.label("last_error_message"),
            ExecutionHistory.error_category.label("last_error_category"),
            ExecutionHistory.execution_time.label("last_error_time"),
        )
        .join(Site, BlogSchedule.site_id == Site.id)
        .outerjoin(
            latest_fail_sub,
            BlogSchedule.id == latest_fail_sub.c.schedule_id,
        )
        .outerjoin(
            ExecutionHistory,
            (ExecutionHistory.schedule_id == BlogSchedule.id)
            & (ExecutionHistory.execution_time == latest_fail_sub.c.max_time)
            & (ExecutionHistory.success == False),
        )
        .where(
            BlogSchedule.user_id == current_user.id,
            BlogSchedule.retry_count > 0,
        )
        .order_by(BlogSchedule.retry_count.desc())
    )

    results = []
    for r in rows.all():
        guidance = get_guidance(r.last_error_category or "unknown")
        results.append(
            AttentionScheduleResponse(
                id=r.id,
                name=r.name,
                is_active=r.is_active,
                retry_count=r.retry_count,
                site_id=r.site_id,
                site_name=r.site_name,
                last_error_message=r.last_error_message,
                last_error_category=r.last_error_category,
                last_error_time=r.last_error_time,
                error_title=guidance.user_title,
                error_guidance=guidance.user_guidance,
            )
        )
    return results


@router.post("/{schedule_id}/skip", response_model=SkipDateResponse)
async def skip_date(
    schedule_id: str,
    data: SkipDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a date to the schedule's skipped_dates list."""
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Validate date is in the future
    skip_date_obj = datetime.strptime(data.date, "%Y-%m-%d").date()
    if skip_date_obj <= date.today():
        raise HTTPException(status_code=400, detail="Can only skip future dates")

    # Check not already skipped
    current_skipped = list(schedule.skipped_dates or [])
    if data.date in current_skipped:
        raise HTTPException(status_code=400, detail="Date is already skipped")

    # Reassign list (new object) to trigger SQLAlchemy dirty detection
    current_skipped.append(data.date)
    schedule.skipped_dates = current_skipped

    await db.commit()

    return SkipDateResponse(
        schedule_id=schedule.id,
        skipped_dates=schedule.skipped_dates,
        message=f"Skipped run on {data.date}",
    )


@router.delete("/{schedule_id}/skip", response_model=SkipDateResponse)
async def unskip_date(
    schedule_id: str,
    data: SkipDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a date from the schedule's skipped_dates list (restore)."""
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    current_skipped = list(schedule.skipped_dates or [])
    if data.date not in current_skipped:
        raise HTTPException(status_code=400, detail="Date is not in skipped list")

    current_skipped.remove(data.date)
    schedule.skipped_dates = current_skipped

    await db.commit()

    return SkipDateResponse(
        schedule_id=schedule.id,
        skipped_dates=schedule.skipped_dates,
        message=f"Restored run on {data.date}",
    )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogSchedule)
        .where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    update_data = data.model_dump(exclude_unset=True)

    # Review workflow gate on update
    if "post_status" in update_data and update_data["post_status"] == "pending_review":
        from app.services.tier_limits import check_feature_access
        check_feature_access(current_user, "review_workflow")

    for key, value in update_data.items():
        setattr(schedule, key, value)

    # Validate experience notes when activating
    if schedule.is_active:
        await _validate_template_experience(db, schedule.prompt_template_id)

    # Sync scheduler
    if schedule.is_active:
        add_schedule_job(schedule)
        schedule.next_run = _compute_next_run(schedule)
    else:
        remove_schedule_job(schedule.id)
        schedule.next_run = None

    await db.commit()

    # Re-query with relationships
    result = await db.execute(
        select(BlogSchedule)
        .where(BlogSchedule.id == schedule_id)
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    return result.scalar_one()


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    remove_schedule_job(schedule.id)
    await db.delete(schedule)
    await db.commit()


@router.patch("/{schedule_id}/activate", response_model=ScheduleResponse)
async def activate_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    from app.services.tier_limits import require_active_subscription

    await require_active_subscription(current_user)
    await _validate_template_experience(db, schedule.prompt_template_id)

    schedule.is_active = True
    schedule.retry_count = 0
    add_schedule_job(schedule)
    schedule.next_run = _compute_next_run(schedule)
    await db.commit()

    result = await db.execute(
        select(BlogSchedule)
        .where(BlogSchedule.id == schedule_id)
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    return result.scalar_one()


@router.patch("/{schedule_id}/deactivate", response_model=ScheduleResponse)
async def deactivate_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    schedule.is_active = False
    remove_schedule_job(schedule.id)
    schedule.next_run = None
    await db.commit()

    result = await db.execute(
        select(BlogSchedule)
        .where(BlogSchedule.id == schedule_id)
        .options(
            selectinload(BlogSchedule.site),
            selectinload(BlogSchedule.prompt_template),
        )
    )
    return result.scalar_one()


@router.get("/{schedule_id}/executions", response_model=PaginatedExecutionResponse)
async def get_executions(
    schedule_id: str,
    limit: int = 10,
    offset: int = 0,
    success_filter: str | None = Query(default=None, description="Filter: 'success', 'failure', or None for all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify ownership
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Schedule not found")

    base_filter = [ExecutionHistory.schedule_id == schedule_id]
    if success_filter == "success":
        base_filter.append(ExecutionHistory.success == True)
    elif success_filter == "failure":
        base_filter.append(ExecutionHistory.success == False)

    # Total count
    total = (
        await db.execute(
            select(func.count(ExecutionHistory.id)).where(*base_filter)
        )
    ).scalar() or 0

    result = await db.execute(
        select(ExecutionHistory)
        .where(*base_filter)
        .order_by(ExecutionHistory.execution_time.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = result.scalars().all()
    return PaginatedExecutionResponse(total=total, entries=entries)


@router.post("/{schedule_id}/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a schedule execution now."""
    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )
    result = await db.execute(
        select(BlogSchedule).where(
            BlogSchedule.id == schedule_id,
            BlogSchedule.user_id == current_user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not schedule.is_active:
        raise HTTPException(status_code=400, detail="Schedule is not active")

    execution_result = await trigger_schedule_now(schedule.id)
    return execution_result
