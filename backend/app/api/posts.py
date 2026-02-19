import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.services.maintenance import is_maintenance_mode
from app.models.blog_post import BlogPost
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.schemas.posts import (
    BulkActionRequest,
    BulkRejectRequest,
    CarouselRequest,
    MarkPublishedRequest,
    PostCountsResponse,
    PostCreate,
    PostResponse,
    PostUpdate,
    RejectRequest,
    ReviseRequest,
)
from app.services.publishing import PublishError, publish_post as publish_to_platform

logger = logging.getLogger(__name__)

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


@router.get("/stats/counts", response_model=PostCountsResponse)
async def get_post_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BlogPost.status, func.count())
        .where(BlogPost.user_id == current_user.id)
        .group_by(BlogPost.status)
    )
    counts = {row[0]: row[1] for row in result.all()}
    return PostCountsResponse(
        pending_review=counts.get("pending_review", 0),
        draft=counts.get("draft", 0),
        published=counts.get("published", 0),
        rejected=counts.get("rejected", 0),
    )


@router.post("/bulk/publish", response_model=list[PostResponse])
async def bulk_publish(
    data: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []
    for post_id in data.post_ids:
        result = await db.execute(
            select(BlogPost).where(
                BlogPost.id == post_id, BlogPost.user_id == current_user.id
            )
        )
        post = result.scalar_one_or_none()
        if not post or post.status == "published":
            continue

        # Eager-load site for publishing
        result = await db.execute(
            select(BlogPost)
            .where(BlogPost.id == post_id)
            .options(selectinload(BlogPost.site))
        )
        post = result.scalar_one()

        try:
            pub_result = await publish_to_platform(post, post.site)
            post.platform_post_id = pub_result.platform_post_id
            post.published_url = pub_result.published_url
            post.status = "published"
            post.published_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(post)
            results.append(post)
        except PublishError:
            continue

    return results


@router.post("/bulk/reject", response_model=list[PostResponse])
async def bulk_reject(
    data: BulkRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []
    for post_id in data.post_ids:
        result = await db.execute(
            select(BlogPost).where(
                BlogPost.id == post_id, BlogPost.user_id == current_user.id
            )
        )
        post = result.scalar_one_or_none()
        if not post:
            continue
        post.status = "rejected"
        post.review_notes = data.review_notes
        await db.commit()

        result = await db.execute(
            select(BlogPost)
            .where(BlogPost.id == post_id)
            .options(selectinload(BlogPost.site))
        )
        results.append(result.scalar_one())

    return results


@router.post("/{post_id}/mark-published", response_model=PostResponse)
async def mark_published(
    post_id: str,
    data: MarkPublishedRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a copy-platform post as published (user confirms they pasted it)."""
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post_id, BlogPost.user_id == current_user.id)
        .options(selectinload(BlogPost.site))
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.site or post.site.platform != "copy":
        raise HTTPException(status_code=400, detail="Mark as Published is only for Copy & Paste sites")
    if post.status == "published":
        raise HTTPException(status_code=400, detail="Post is already published")

    post.status = "published"
    post.published_at = datetime.now(timezone.utc)
    post.platform_post_id = f"copy-{post.id}"
    post.published_url = data.published_url or (post.site.url if post.site else None)
    await db.commit()

    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.id == post_id)
        .options(selectinload(BlogPost.site))
    )
    return result.scalar_one()


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
    post.updated_at = datetime.now(timezone.utc)

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


@router.post("/{post_id}/repurpose-linkedin")
async def repurpose_linkedin(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a LinkedIn post from a blog article (Tribune+ only)."""
    from app.services.tier_limits import check_feature_access
    from app.services.content import repurpose_to_linkedin

    check_feature_access(current_user, "repurpose_linkedin")

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )

    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not post.content:
        raise HTTPException(status_code=400, detail="Post has no content to repurpose")

    # Load template for industry tone calibration + voice injection
    template = None
    if post.prompt_template_id:
        tmpl_result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == post.prompt_template_id)
        )
        template = tmpl_result.scalar_one_or_none()

    try:
        linkedin_text = await repurpose_to_linkedin(
            post.content,
            post.title,
            industry=template.industry if template else None,
            template=template,
        )
    except Exception as exc:
        logger.error(f"LinkedIn repurpose failed for post {post_id}: {exc}")
        raise HTTPException(status_code=502, detail="LinkedIn post generation failed")

    # Tell the frontend whether voice profile was injected
    has_voice = bool(
        template
        and (
            template.brand_voice_description
            or (template.personality_level is not None and template.personality_level != 5)
            or template.perspective
            or template.default_tone
            or template.use_anecdotes
            or template.use_rhetorical_questions
            or template.use_humor
            or template.use_contractions is False
            or template.phrases_to_avoid
            or template.preferred_terms
        )
    )
    return {"linkedin_post": linkedin_text, "voice_applied": has_voice}


@router.post("/{post_id}/generate-carousel")
async def generate_carousel(
    post_id: str,
    data: CarouselRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a LinkedIn carousel PDF from a blog post (Tribune+ only)."""
    from app.services.tier_limits import check_feature_access
    from app.services.carousel import generate_carousel as build_carousel

    check_feature_access(current_user, "generate_carousel")

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )

    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not post.content:
        raise HTTPException(status_code=400, detail="Post has no content to generate a carousel from")

    # Load template for saved branding defaults
    template = None
    if post.prompt_template_id:
        tmpl_result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == post.prompt_template_id)
        )
        template = tmpl_result.scalar_one_or_none()

    try:
        carousel_result = await build_carousel(
            content_html=post.content,
            title=post.title,
            template=template,
            request_branding=data.branding if data else None,
            featured_image_url=post.featured_image_url,
        )
    except Exception as exc:
        logger.error(f"Carousel generation failed for post {post_id}: {exc}")
        raise HTTPException(status_code=502, detail="Carousel generation failed")

    # Build a safe filename from the title
    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in post.title)[:50].strip()
    filename = f"{safe_title} - Carousel.pdf" if safe_title else "carousel.pdf"

    return Response(
        content=carousel_result.pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/{post_id}/revise-stream")
async def revise_stream(
    post_id: str,
    data: ReviseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming endpoint for AI-powered content revision."""
    from app.services.tier_limits import check_feature_access

    check_feature_access(current_user, "revise_with_ai")

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )
    result = await db.execute(
        select(BlogPost).where(
            BlogPost.id == post_id, BlogPost.user_id == current_user.id
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status not in ("draft", "pending_review"):
        raise HTTPException(
            status_code=400,
            detail="Only draft or pending_review posts can be revised",
        )

    # Load template for voice settings (graceful if deleted)
    template = None
    if post.prompt_template_id:
        tmpl_result = await db.execute(
            select(PromptTemplate).where(PromptTemplate.id == post.prompt_template_id)
        )
        template = tmpl_result.scalar_one_or_none()

    # System prompt fallback chain: stored on post → rebuilt from template → generic
    system_prompt = post.system_prompt_used
    if not system_prompt and template:
        from app.services.content import build_content_system_prompt
        system_prompt = build_content_system_prompt(template)
    if not system_prompt:
        system_prompt = (
            "You are a professional content editor. Revise the article "
            "based on the feedback while maintaining quality and consistency."
        )

    queue: asyncio.Queue = asyncio.Queue()

    async def progress_callback(stage: str, step: int, total: int, message: str):
        await queue.put({
            "event": "progress",
            "data": {"stage": stage, "step": step, "total": total, "message": message},
        })

    async def run_revision():
        from app.services.content import revise_content
        try:
            revision_result = await revise_content(
                content_html=post.content,
                feedback=data.feedback,
                system_prompt=system_prompt,
                template=template,
                progress_callback=progress_callback,
            )
            await queue.put({
                "event": "complete",
                "data": {
                    "content_html": revision_result.content_html,
                    "excerpt": revision_result.excerpt,
                },
            })
        except Exception as e:
            logger.error(f"SSE revision failed: {e}")
            await queue.put({
                "event": "error",
                "data": {"detail": str(e)},
            })

    async def event_stream():
        task = asyncio.create_task(run_revision())
        try:
            while True:
                msg = await queue.get()
                event_type = msg["event"]
                payload = json.dumps(msg["data"])
                yield f"event: {event_type}\ndata: {payload}\n\n"
                if event_type in ("complete", "error"):
                    break
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
