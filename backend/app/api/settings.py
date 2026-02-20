from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.api.deps import get_current_user
from app.models.user import User
from app.models.site import Site, Category, Tag
from app.models.prompt_template import PromptTemplate
from app.models.blog_post import BlogPost, ExecutionHistory
from app.models.blog_schedule import BlogSchedule
from app.models.feedback import Feedback
from app.models.notification import Notification
from app.schemas.auth import UserResponse
from app.schemas.settings import (
    ApiKeyStatus,
    DeleteAccount,
    PasswordChange,
    ProfileUpdate,
    UsageSummary,
)
from app.services.scheduler import remove_schedule_job

router = APIRouter(prefix="/settings", tags=["settings"])


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.email and data.email != current_user.email:
        existing = await db.execute(
            select(User).where(User.email == data.email, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )
        current_user.email = data.email

    if data.full_name is not None:
        current_user.full_name = data.full_name

    if data.timezone is not None:
        current_user.timezone = data.timezone

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {"detail": "Password updated successfully"}


@router.get("/api-status", response_model=ApiKeyStatus)
async def get_api_key_status(
    _user: User = Depends(get_current_user),
):
    return ApiKeyStatus(
        openai=bool(app_settings.OPENAI_API_KEY),
        unsplash=bool(app_settings.UNSPLASH_ACCESS_KEY),
    )


@router.get("/usage", response_model=UsageSummary)
async def get_usage_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id

    # Post counts by status
    post_q = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((BlogPost.status == "published", 1), else_=0)).label("published"),
            func.sum(case((BlogPost.status == "pending_review", 1), else_=0)).label("pending"),
            func.sum(case((BlogPost.status == "draft", 1), else_=0)).label("draft"),
        ).where(BlogPost.user_id == user_id)
    )
    post_row = post_q.one()

    # Execution counts + cost
    exec_q = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((ExecutionHistory.success == True, 1), else_=0)).label("success"),
            func.sum(case((ExecutionHistory.success == False, 1), else_=0)).label("failure"),
            func.coalesce(func.sum(ExecutionHistory.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(ExecutionHistory.estimated_cost_usd), 0).label("text_cost"),
            func.coalesce(func.sum(ExecutionHistory.image_cost_usd), 0).label("image_cost"),
        ).where(ExecutionHistory.user_id == user_id)
    )
    exec_row = exec_q.one()

    text_cost = float(exec_row.text_cost or 0)
    image_cost = float(exec_row.image_cost or 0)

    return UsageSummary(
        total_posts=post_row.total or 0,
        published_posts=int(post_row.published or 0),
        pending_review_posts=int(post_row.pending or 0),
        draft_posts=int(post_row.draft or 0),
        total_executions=exec_row.total or 0,
        successful_executions=int(exec_row.success or 0),
        failed_executions=int(exec_row.failure or 0),
        total_tokens=int(exec_row.tokens or 0),
        estimated_cost_usd=round(text_cost, 4),
        image_cost_usd=round(image_cost, 4),
        total_cost_usd=round(text_cost + image_cost, 4),
        member_since=current_user.created_at,
    )


def _serialize(obj, exclude: set[str] | None = None) -> dict:
    """Convert a SQLAlchemy model instance to a JSON-safe dict."""
    exclude = exclude or set()
    result = {}
    for col in obj.__table__.columns:
        if col.name in exclude:
            continue
        val = getattr(obj, col.name)
        if hasattr(val, "isoformat"):
            val = val.isoformat()
        elif hasattr(val, "hex"):
            val = str(val)
        result[col.name] = val
    return result


@router.get("/export-data")
async def export_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all user data as JSON (GDPR data portability)."""
    uid = current_user.id

    # Sites with categories & tags
    sites_q = await db.execute(
        select(Site)
        .where(Site.user_id == uid)
        .options(selectinload(Site.categories), selectinload(Site.tags))
    )
    sites = []
    for site in sites_q.scalars():
        s = _serialize(
            site,
            exclude={
                "api_key",
                "wp_username_encrypted",
                "wp_app_password_encrypted",
            },
        )
        s["categories"] = [_serialize(c) for c in site.categories]
        s["tags"] = [_serialize(t) for t in site.tags]
        sites.append(s)

    # Templates
    templates_q = await db.execute(
        select(PromptTemplate).where(PromptTemplate.user_id == uid)
    )
    templates = [_serialize(t) for t in templates_q.scalars()]

    # Schedules
    schedules_q = await db.execute(
        select(BlogSchedule).where(BlogSchedule.user_id == uid)
    )
    schedules = [_serialize(s) for s in schedules_q.scalars()]

    # Posts
    posts_q = await db.execute(
        select(BlogPost).where(BlogPost.user_id == uid)
    )
    posts = [_serialize(p) for p in posts_q.scalars()]

    # Execution history
    execs_q = await db.execute(
        select(ExecutionHistory).where(ExecutionHistory.user_id == uid)
    )
    executions = [_serialize(e) for e in execs_q.scalars()]

    # Feedback
    feedback_q = await db.execute(
        select(Feedback).where(Feedback.user_id == uid)
    )
    feedbacks = [_serialize(f) for f in feedback_q.scalars()]

    # Notifications
    notif_q = await db.execute(
        select(Notification).where(Notification.user_id == uid)
    )
    notifications = [_serialize(n) for n in notif_q.scalars()]

    export = {
        "exported_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "account": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "timezone": current_user.timezone,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at.isoformat(),
            "updated_at": current_user.updated_at.isoformat(),
        },
        "sites": sites,
        "prompt_templates": templates,
        "schedules": schedules,
        "blog_posts": posts,
        "execution_history": executions,
        "feedback": feedbacks,
        "notifications": notifications,
    }

    return JSONResponse(
        content=export,
        headers={
            "Content-Disposition": "attachment; filename=acta-ai-data-export.json"
        },
    )


@router.delete("/account")
async def delete_account(
    data: DeleteAccount,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the current user's account and all associated data."""
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect",
        )

    # Remove any active scheduler jobs for this user's schedules
    schedules = await db.execute(
        select(BlogSchedule).where(BlogSchedule.user_id == current_user.id)
    )
    for schedule in schedules.scalars():
        remove_schedule_job(schedule.id)

    # Delete the user — all related data cascades at the DB level
    await db.delete(current_user)
    await db.commit()

    return {"detail": "Account deleted successfully"}
