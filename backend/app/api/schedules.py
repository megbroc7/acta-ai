from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.blog_post import BlogPost, ExecutionHistory
from app.models.blog_schedule import BlogSchedule
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.schemas.schedules import (
    CalendarEvent,
    CalendarResponse,
    ExecutionHistoryResponse,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
)
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
    # Validate experience notes if activating immediately
    if data.is_active:
        await _validate_template_experience(db, data.prompt_template_id)

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
                ))
                future_offset += 1

            safety_count += 1
            current_fire = trigger.get_next_fire_time(current_fire, current_fire)

    # Sort by date
    events.sort(key=lambda e: e.date)

    return CalendarResponse(events=events, start=start, end=end)


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


@router.get("/{schedule_id}/executions", response_model=list[ExecutionHistoryResponse])
async def get_executions(
    schedule_id: str,
    limit: int = 10,
    offset: int = 0,
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

    result = await db.execute(
        select(ExecutionHistory)
        .where(ExecutionHistory.schedule_id == schedule_id)
        .order_by(ExecutionHistory.execution_time.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{schedule_id}/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a schedule execution now."""
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
