import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.site import Site
from app.models.prompt_template import PromptTemplate
from app.models.blog_schedule import BlogSchedule
from app.models.blog_post import BlogPost, ExecutionHistory
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminPasswordResetResponse,
    AdminUserDetail,
    AdminUserError,
    AdminUserPost,
    AdminUserResponse,
    AdminUserSchedule,
    AdminUserSite,
    AdminUserTemplate,
    DailyCount,
    ErrorLogEntry,
    ErrorLogResponse,
    MonthlyCost,
    PlatformBreakdown,
    ScheduleOversightEntry,
    SchedulerDayHealth,
    StatusBreakdown,
    UserActivity,
)
from app.services.scheduler import (
    _compute_next_run,
    add_schedule_job,
    remove_schedule_job,
)

router = APIRouter(prefix="/admin", tags=["admin"])

# Rough cost estimates per OpenAI call (GPT-4o-mini)
COST_PER_EXECUTION = 0.025  # ~$0.025 per full pipeline (titles + outline + draft + review)
COST_PER_IMAGE = 0.04  # DALL-E 3 standard


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # --- Scalar counts ---
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_sites = (await db.execute(select(func.count(Site.id)))).scalar() or 0
    total_templates = (await db.execute(select(func.count(PromptTemplate.id)))).scalar() or 0
    total_schedules = (await db.execute(select(func.count(BlogSchedule.id)))).scalar() or 0
    total_posts = (await db.execute(select(func.count(BlogPost.id)))).scalar() or 0
    active_schedules = (
        await db.execute(
            select(func.count(BlogSchedule.id)).where(BlogSchedule.is_active == True)
        )
    ).scalar() or 0

    # --- Posts over time ---
    post_date_col = func.date(BlogPost.created_at)
    posts_over_time_q = await db.execute(
        select(post_date_col.label("date"), func.count().label("count"))
        .where(BlogPost.created_at >= since)
        .group_by(post_date_col)
        .order_by(post_date_col)
    )
    posts_over_time = [
        DailyCount(date=str(row.date), count=row.count)
        for row in posts_over_time_q.all()
    ]

    # --- Status breakdown ---
    status_q = await db.execute(
        select(BlogPost.status, func.count().label("count")).group_by(BlogPost.status)
    )
    status_map = {row.status: row.count for row in status_q.all()}
    status_breakdown = StatusBreakdown(
        draft=status_map.get("draft", 0),
        pending_review=status_map.get("pending_review", 0),
        published=status_map.get("published", 0),
        rejected=status_map.get("rejected", 0),
    )

    # --- Platform breakdown ---
    platform_q = await db.execute(
        select(Site.platform, func.count().label("count")).group_by(Site.platform)
    )
    platform_breakdown = [
        PlatformBreakdown(platform=row.platform, count=row.count)
        for row in platform_q.all()
    ]

    # --- Scheduler health ---
    exec_date_col = func.date(ExecutionHistory.execution_time)
    health_q = await db.execute(
        select(
            exec_date_col.label("date"),
            func.sum(case((ExecutionHistory.success == True, 1), else_=0)).label("success"),
            func.sum(case((ExecutionHistory.success == False, 1), else_=0)).label("failure"),
        )
        .where(ExecutionHistory.execution_time >= since)
        .group_by(exec_date_col)
        .order_by(exec_date_col)
    )
    scheduler_health = [
        SchedulerDayHealth(date=str(row.date), success=row.success, failure=row.failure)
        for row in health_q.all()
    ]

    # --- User activity ---
    # Subqueries for per-user counts
    sites_sub = (
        select(Site.user_id, func.count().label("cnt"))
        .group_by(Site.user_id)
        .subquery()
    )
    templates_sub = (
        select(PromptTemplate.user_id, func.count().label("cnt"))
        .group_by(PromptTemplate.user_id)
        .subquery()
    )
    schedules_sub = (
        select(BlogSchedule.user_id, func.count().label("cnt"))
        .group_by(BlogSchedule.user_id)
        .subquery()
    )
    posts_sub = (
        select(BlogPost.user_id, func.count().label("cnt"))
        .group_by(BlogPost.user_id)
        .subquery()
    )
    last_post_sub = (
        select(BlogPost.user_id, func.max(BlogPost.created_at).label("last"))
        .group_by(BlogPost.user_id)
        .subquery()
    )

    user_q = await db.execute(
        select(
            User.id,
            User.email,
            User.full_name,
            User.is_active,
            User.is_admin,
            User.created_at,
            func.coalesce(sites_sub.c.cnt, 0).label("sites"),
            func.coalesce(templates_sub.c.cnt, 0).label("templates"),
            func.coalesce(schedules_sub.c.cnt, 0).label("schedules"),
            func.coalesce(posts_sub.c.cnt, 0).label("posts"),
            last_post_sub.c.last.label("last_active"),
        )
        .outerjoin(sites_sub, User.id == sites_sub.c.user_id)
        .outerjoin(templates_sub, User.id == templates_sub.c.user_id)
        .outerjoin(schedules_sub, User.id == schedules_sub.c.user_id)
        .outerjoin(posts_sub, User.id == posts_sub.c.user_id)
        .outerjoin(last_post_sub, User.id == last_post_sub.c.user_id)
        .order_by(func.coalesce(last_post_sub.c.last, User.created_at).desc())
    )
    user_activity = [
        UserActivity(
            id=row.id,
            email=row.email,
            full_name=row.full_name,
            is_active=row.is_active,
            is_admin=row.is_admin,
            created_at=row.created_at,
            sites=row.sites,
            templates=row.templates,
            schedules=row.schedules,
            posts=row.posts,
            last_active=row.last_active,
        )
        for row in user_q.all()
    ]

    # --- Cost estimates (monthly) ---
    exec_month_col = func.to_char(ExecutionHistory.execution_time, "YYYY-MM")
    cost_q = await db.execute(
        select(
            exec_month_col.label("month"),
            func.count().label("total_executions"),
        )
        .where(ExecutionHistory.execution_time >= since)
        .group_by(exec_month_col)
        .order_by(exec_month_col)
    )
    cost_estimates = [
        MonthlyCost(
            month=row.month,
            estimated_usd=round(row.total_executions * COST_PER_EXECUTION, 2),
        )
        for row in cost_q.all()
    ]

    # --- Signups over time ---
    signup_date_col = func.date(User.created_at)
    signup_q = await db.execute(
        select(signup_date_col.label("date"), func.count().label("count"))
        .where(User.created_at >= since)
        .group_by(signup_date_col)
        .order_by(signup_date_col)
    )
    signups_over_time = [
        DailyCount(date=str(row.date), count=row.count)
        for row in signup_q.all()
    ]

    return AdminDashboardResponse(
        total_users=total_users,
        total_sites=total_sites,
        total_templates=total_templates,
        total_schedules=total_schedules,
        total_posts=total_posts,
        active_schedules=active_schedules,
        posts_over_time=posts_over_time,
        status_breakdown=status_breakdown,
        platform_breakdown=platform_breakdown,
        scheduler_health=scheduler_health,
        user_activity=user_activity,
        cost_estimates=cost_estimates,
        signups_over_time=signups_over_time,
    )


# --- Global error log ---


@router.get("/errors", response_model=ErrorLogResponse)
async def get_error_log(
    days: int = Query(default=7, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    base_filter = [
        ExecutionHistory.success == False,
        ExecutionHistory.execution_time >= since,
    ]

    # Total count
    total = (
        await db.execute(
            select(func.count(ExecutionHistory.id)).where(*base_filter)
        )
    ).scalar() or 0

    # Entries with user + schedule context
    rows = await db.execute(
        select(
            ExecutionHistory.id,
            ExecutionHistory.execution_time,
            ExecutionHistory.execution_type,
            ExecutionHistory.error_message,
            User.email.label("user_email"),
            User.full_name.label("user_full_name"),
            BlogSchedule.name.label("schedule_name"),
        )
        .join(User, ExecutionHistory.user_id == User.id)
        .join(BlogSchedule, ExecutionHistory.schedule_id == BlogSchedule.id)
        .where(*base_filter)
        .order_by(ExecutionHistory.execution_time.desc())
        .offset(offset)
        .limit(limit)
    )

    entries = [
        ErrorLogEntry(
            id=r.id,
            execution_time=r.execution_time,
            execution_type=r.execution_type,
            error_message=r.error_message,
            user_email=r.user_email,
            user_full_name=r.user_full_name,
            schedule_name=r.schedule_name,
        )
        for r in rows.all()
    ]

    return ErrorLogResponse(total=total, entries=entries)


# --- Schedule oversight ---


@router.get("/schedules", response_model=list[ScheduleOversightEntry])
async def get_all_schedules(
    active_only: bool = Query(default=False),
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(
            BlogSchedule.id,
            BlogSchedule.name,
            BlogSchedule.frequency,
            BlogSchedule.is_active,
            BlogSchedule.next_run,
            BlogSchedule.last_run,
            User.email.label("user_email"),
            User.full_name.label("user_full_name"),
            Site.name.label("site_name"),
            Site.platform.label("site_platform"),
            PromptTemplate.name.label("template_name"),
            PromptTemplate.industry.label("template_industry"),
        )
        .join(User, BlogSchedule.user_id == User.id)
        .join(Site, BlogSchedule.site_id == Site.id)
        .join(PromptTemplate, BlogSchedule.prompt_template_id == PromptTemplate.id)
    )

    if active_only:
        query = query.where(BlogSchedule.is_active == True)

    query = query.order_by(BlogSchedule.is_active.desc(), BlogSchedule.next_run.asc().nullslast())

    rows = await db.execute(query)
    return [
        ScheduleOversightEntry(
            id=r.id,
            name=r.name,
            frequency=r.frequency,
            is_active=r.is_active,
            next_run=r.next_run,
            last_run=r.last_run,
            user_email=r.user_email,
            user_full_name=r.user_full_name,
            site_name=r.site_name,
            site_platform=r.site_platform,
            template_name=r.template_name,
            template_industry=r.template_industry,
        )
        for r in rows.all()
    ]


@router.patch(
    "/schedules/{schedule_id}/toggle-active",
    response_model=ScheduleOversightEntry,
)
async def toggle_schedule_active(
    schedule_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlogSchedule).where(BlogSchedule.id == schedule_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    if schedule.is_active:
        # Deactivate
        schedule.is_active = False
        remove_schedule_job(schedule.id)
        schedule.next_run = None
    else:
        # Activate — validate experience notes first
        tmpl_result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == schedule.prompt_template_id)
        )
        template = tmpl_result.scalar_one_or_none()
        if not template or not (template.experience_notes or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot activate: template's Experience Notes field is empty.",
            )
        schedule.is_active = True
        schedule.retry_count = 0
        add_schedule_job(schedule)
        schedule.next_run = _compute_next_run(schedule)

    await db.commit()
    await db.refresh(schedule)

    # Fetch joined data for response
    row = await db.execute(
        select(
            BlogSchedule.id,
            BlogSchedule.name,
            BlogSchedule.frequency,
            BlogSchedule.is_active,
            BlogSchedule.next_run,
            BlogSchedule.last_run,
            User.email.label("user_email"),
            User.full_name.label("user_full_name"),
            Site.name.label("site_name"),
            Site.platform.label("site_platform"),
            PromptTemplate.name.label("template_name"),
            PromptTemplate.industry.label("template_industry"),
        )
        .join(User, BlogSchedule.user_id == User.id)
        .join(Site, BlogSchedule.site_id == Site.id)
        .join(PromptTemplate, BlogSchedule.prompt_template_id == PromptTemplate.id)
        .where(BlogSchedule.id == schedule_id)
    )
    r = row.one()
    return ScheduleOversightEntry(
        id=r.id,
        name=r.name,
        frequency=r.frequency,
        is_active=r.is_active,
        next_run=r.next_run,
        last_run=r.last_run,
        user_email=r.user_email,
        user_full_name=r.user_full_name,
        site_name=r.site_name,
        site_platform=r.site_platform,
        template_name=r.template_name,
        template_industry=r.template_industry,
    )


# --- User management endpoints ---


async def _get_target_user(user_id: uuid.UUID, db: AsyncSession) -> User:
    """Fetch a user by ID or raise 404."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch(
    "/users/{user_id}/toggle-active",
    response_model=AdminUserResponse,
)
async def toggle_user_active(
    user_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot toggle your own active status",
        )
    target = await _get_target_user(user_id, db)
    target.is_active = not target.is_active
    await db.commit()
    await db.refresh(target)
    return AdminUserResponse(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        is_active=target.is_active,
        is_admin=target.is_admin,
    )


@router.patch(
    "/users/{user_id}/toggle-admin",
    response_model=AdminUserResponse,
)
async def toggle_user_admin(
    user_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot toggle your own admin status",
        )
    target = await _get_target_user(user_id, db)
    target.is_admin = not target.is_admin
    await db.commit()
    await db.refresh(target)
    return AdminUserResponse(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        is_active=target.is_active,
        is_admin=target.is_admin,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    target = await _get_target_user(user_id, db)
    await db.delete(target)
    await db.commit()


@router.post(
    "/users/{user_id}/reset-password",
    response_model=AdminPasswordResetResponse,
)
async def reset_user_password(
    user_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_target_user(user_id, db)
    temp_password = secrets.token_urlsafe(12)
    target.hashed_password = hash_password(temp_password)
    await db.commit()
    return AdminPasswordResetResponse(temporary_password=temp_password)


@router.get(
    "/users/{user_id}/detail",
    response_model=AdminUserDetail,
)
async def get_user_detail(
    user_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify user exists
    await _get_target_user(user_id, db)

    # Sites
    sites_q = await db.execute(
        select(Site.name, Site.platform, Site.is_active)
        .where(Site.user_id == user_id)
        .order_by(Site.name)
    )
    sites = [
        AdminUserSite(name=r.name, platform=r.platform, is_active=r.is_active)
        for r in sites_q.all()
    ]

    # Templates
    templates_q = await db.execute(
        select(PromptTemplate.name, PromptTemplate.industry)
        .where(PromptTemplate.user_id == user_id)
        .order_by(PromptTemplate.name)
    )
    templates = [
        AdminUserTemplate(name=r.name, industry=r.industry)
        for r in templates_q.all()
    ]

    # Schedules
    schedules_q = await db.execute(
        select(
            BlogSchedule.name,
            BlogSchedule.frequency,
            BlogSchedule.is_active,
            BlogSchedule.last_run,
        )
        .where(BlogSchedule.user_id == user_id)
        .order_by(BlogSchedule.name)
    )
    schedules = [
        AdminUserSchedule(
            name=r.name, frequency=r.frequency, is_active=r.is_active, last_run=r.last_run
        )
        for r in schedules_q.all()
    ]

    # Recent posts (last 5)
    posts_q = await db.execute(
        select(BlogPost.title, BlogPost.status, BlogPost.created_at)
        .where(BlogPost.user_id == user_id)
        .order_by(BlogPost.created_at.desc())
        .limit(5)
    )
    recent_posts = [
        AdminUserPost(title=r.title, status=r.status, created_at=r.created_at)
        for r in posts_q.all()
    ]

    # Recent errors (last 5 failed executions)
    errors_q = await db.execute(
        select(ExecutionHistory.execution_time, ExecutionHistory.error_message)
        .where(
            ExecutionHistory.user_id == user_id,
            ExecutionHistory.success == False,
        )
        .order_by(ExecutionHistory.execution_time.desc())
        .limit(5)
    )
    recent_errors = [
        AdminUserError(execution_time=r.execution_time, error_message=r.error_message)
        for r in errors_q.all()
    ]

    return AdminUserDetail(
        sites=sites,
        templates=templates,
        schedules=schedules,
        recent_posts=recent_posts,
        recent_errors=recent_errors,
    )
