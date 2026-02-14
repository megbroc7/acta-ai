from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.blog_post import BlogPost
from app.models.user import User
from app.schemas.posts import PostCreate, PostResponse, PostUpdate, RejectRequest
from app.services.publishing import PublishError, publish_post as publish_to_platform

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = BlogPost(user_id=current_user.id, **data.model_dump())
    db.add(post)
    await db.commit()
    await db.refresh(post)

    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post.id)
        .options(selectinload(BlogPost.site))
    )
    return result.scalar_one()


@router.get("/", response_model=list[PostResponse])
async def list_posts(
    site_id: str | None = Query(None),
    schedule_id: str | None = Query(None),
    post_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(BlogPost)
        .where(BlogPost.user_id == current_user.id)
        .options(selectinload(BlogPost.site))
        .order_by(BlogPost.created_at.desc())
    )
    if site_id:
        query = query.where(BlogPost.site_id == site_id)
    if schedule_id:
        query = query.where(BlogPost.schedule_id == schedule_id)
    if post_status:
        query = query.where(BlogPost.status == post_status)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post_id, BlogPost.user_id == current_user.id)
        .options(selectinload(BlogPost.site))
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    data: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(post, key, value)

    await db.commit()

    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post_id)
        .options(selectinload(BlogPost.site))
    )
    return result.scalar_one()


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    await db.delete(post)
    await db.commit()


@router.post("/{post_id}/publish", response_model=PostResponse)
async def publish_post(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status == "published":
        raise HTTPException(status_code=400, detail="Post is already published")

    # Eager-load the site relationship for the publishing service
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post_id)
        .options(selectinload(BlogPost.site))
    )
    post = result.scalar_one()

    try:
        pub_result = await publish_to_platform(post, post.site)
    except PublishError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    post.platform_post_id = pub_result.platform_post_id
    post.published_url = pub_result.published_url
    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(post)
    return post


@router.post("/{post_id}/reject", response_model=PostResponse)
async def reject_post(
    post_id: str,
    data: RejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = "rejected"
    post.review_notes = data.review_notes
    await db.commit()

    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post_id)
        .options(selectinload(BlogPost.site))
    )
    return result.scalar_one()
