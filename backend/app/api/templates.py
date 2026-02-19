import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.prompt_template import PromptTemplate
from app.models.user import User
from app.services.maintenance import is_maintenance_mode
from app.schemas.templates import (
    ExperienceInterviewResponse,
    InterviewRequest,
    InterviewResponse,
    KeywordSuggestionRequest,
    KeywordSuggestionResponse,
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
    TestContentRequest,
    TestContentResponse,
    TestTopicRequest,
    TestTopicResponse,
    VoiceAnalysisRequest,
    VoiceAnalysisResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/templates", tags=["templates"])

DEFAULT_TEMPLATE = {
    "name": "General Blog Post",
    "description": "A versatile template for generating blog posts on any topic.",
    "system_prompt": (
        "You are a professional blog writer. Write engaging, well-structured content "
        "that is informative and easy to read. Use clear headings, short paragraphs, "
        "and a conversational yet authoritative tone."
    ),
    "topic_generation_prompt": (
        "Generate 5 headline variants for this topic: {idea}\n\n"
        "Each title should be compelling, under 60 characters, and SEO-friendly. "
        "Return exactly 5 titles, numbered 1-5, one per line."
    ),
    "content_generation_prompt": (
        "Write a {word_count}-word blog post titled: {topic}\n\n"
        "Tone: {tone}\n"
        "Open with a hook that demonstrates first-hand experience. "
        "Use markdown formatting with H2 sections. "
        "End with a specific next step for the reader, not a generic summary."
    ),
    "default_word_count": 1500,
    "default_tone": "informative",
    "experience_notes": None,
    "is_default": True,
}


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.tier_limits import check_image_source, check_template_limit, get_effective_tier

    await check_template_limit(db, current_user)
    check_image_source(current_user, data.image_source if hasattr(data, "image_source") else None)

    dump = data.model_dump()

    # Default web_research_enabled to True for Tribune+ users on new templates
    user_tier = get_effective_tier(current_user)
    if user_tier in ("tribune", "imperator") and not dump.get("web_research_enabled"):
        dump["web_research_enabled"] = True
    # Auto-format experience_qa → experience_notes
    if dump.get("experience_qa"):
        from app.services.content import format_experience_qa
        formatted = format_experience_qa(dump["experience_qa"])
        if formatted:
            dump["experience_notes"] = formatted
    template = PromptTemplate(user_id=current_user.id, **dump)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.user_id == current_user.id)
    )
    templates = result.scalars().all()

    # Auto-create default template if user has none
    if not templates:
        from app.services.tier_limits import get_effective_tier
        default_data = {**DEFAULT_TEMPLATE}
        if get_effective_tier(current_user) in ("tribune", "imperator"):
            default_data["web_research_enabled"] = True
        default = PromptTemplate(user_id=current_user.id, **default_data)
        db.add(default)
        await db.commit()
        await db.refresh(default)
        templates = [default]

    return templates


# Must be BEFORE /{template_id} routes to avoid path conflicts
@router.post("/suggest-keywords", response_model=KeywordSuggestionResponse)
async def suggest_keywords(
    data: KeywordSuggestionRequest,
    current_user: User = Depends(get_current_user),
):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    from app.services.seo import suggest_keywords as seo_suggest

    try:
        result = await seo_suggest(
            industry=data.industry,
            topic=data.topic,
            niche=data.niche,
            existing_keywords=data.existing_keywords,
        )
        return result
    except Exception as e:
        logger.error(f"Keyword suggestion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate keyword suggestions",
        )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    data: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = data.model_dump(exclude_unset=True)

    # Validate image source against tier
    if "image_source" in update_data:
        from app.services.tier_limits import check_image_source
        check_image_source(current_user, update_data["image_source"])

    # Auto-format experience_qa → experience_notes
    if "experience_qa" in update_data and update_data["experience_qa"]:
        from app.services.content import format_experience_qa
        formatted = format_experience_qa(update_data["experience_qa"])
        if formatted:
            update_data["experience_notes"] = formatted
    for key, value in update_data.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.commit()


@router.post("/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.tier_limits import check_template_limit

    await check_template_limit(db, current_user)

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    copy = PromptTemplate(
        user_id=current_user.id,
        name=f"{template.name} (Copy)",
        description=template.description,
        system_prompt=template.system_prompt,
        topic_generation_prompt=template.topic_generation_prompt,
        content_generation_prompt=template.content_generation_prompt,
        default_word_count=template.default_word_count,
        default_tone=template.default_tone,
        content_type=template.content_type,
        writing_style=template.writing_style,
        industry=template.industry,
        audience_level=template.audience_level,
        special_requirements=template.special_requirements,
        target_reader=template.target_reader,
        call_to_action=template.call_to_action,
        preferred_terms=template.preferred_terms,
        image_source=template.image_source,
        image_style_guidance=template.image_style_guidance,
        experience_notes=template.experience_notes,
        experience_qa=template.experience_qa,
        placeholders=template.placeholders,
        variables=template.variables,
        is_default=False,
        # Voice Matching
        writing_sample=template.writing_sample,
        voice_match_active=template.voice_match_active,
        # Voice & Humanization
        perspective=template.perspective,
        brand_voice_description=template.brand_voice_description,
        phrases_to_avoid=template.phrases_to_avoid,
        personality_level=template.personality_level,
        use_anecdotes=template.use_anecdotes,
        use_rhetorical_questions=template.use_rhetorical_questions,
        use_humor=template.use_humor,
        use_contractions=template.use_contractions,
        # SEO
        seo_focus_keyword=template.seo_focus_keyword,
        seo_keywords=template.seo_keywords,
        seo_keyword_density=template.seo_keyword_density,
        seo_meta_description_style=template.seo_meta_description_style,
        seo_internal_linking_instructions=template.seo_internal_linking_instructions,
        # Categories & Tags
        default_categories=template.default_categories,
        default_tags=template.default_tags,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return copy


@router.post("/{template_id}/generate-experience-questions", response_model=ExperienceInterviewResponse)
async def generate_experience_questions(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate broad expertise interview questions based on template context."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    from app.services.content import generate_template_interview

    try:
        questions = await generate_template_interview(template)
        return ExperienceInterviewResponse(questions=questions)
    except Exception as e:
        logger.error(f"Experience interview generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate interview questions",
        )


@router.post("/{template_id}/analyze-voice", response_model=VoiceAnalysisResponse)
async def analyze_voice(
    template_id: str,
    data: VoiceAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze a writing sample to detect voice/tone characteristics."""
    from app.services.tier_limits import check_feature_access

    check_feature_access(current_user, "voice_match")

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    from app.services.content import analyze_writing_voice

    try:
        analysis = await analyze_writing_voice(data.writing_sample)
        return VoiceAnalysisResponse(**analysis)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Voice analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to analyze writing sample",
        )


@router.post("/{template_id}/test/topic", response_model=TestTopicResponse)
async def test_topic(
    template_id: str,
    data: TestTopicRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test title generation for a template — preview only, no records created."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Allow test panel to override content_type from unsaved form state
    if data.content_type is not None:
        template.content_type = data.content_type

    from app.services.content import generate_titles

    try:
        title_result = await generate_titles(
            template, data.topic, data.replacements or None
        )
        return TestTopicResponse(
            titles=title_result.titles,
            title_system_prompt_used=title_result.title_system_prompt_used,
            topic_prompt_used=title_result.topic_prompt_used,
        )
    except Exception as e:
        logger.error(f"Test topic generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate titles",
        )


@router.post("/{template_id}/test/interview", response_model=InterviewResponse)
async def test_interview(
    template_id: str,
    data: InterviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate interview questions for a selected title."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    from app.services.content import generate_interview

    try:
        questions = await generate_interview(template, data.title)
        return InterviewResponse(questions=questions)
    except Exception as e:
        logger.error(f"Interview generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate interview questions",
        )


@router.post("/{template_id}/test/content", response_model=TestContentResponse)
async def test_content(
    template_id: str,
    data: TestContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test content generation for a template — preview only, no records created."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Build experience context from template notes + interactive answers
    experience_parts = []
    if template.experience_notes and template.experience_notes.strip():
        experience_parts.append(template.experience_notes.strip())
    answered = [a for a in data.experience_answers if a.strip()]
    if answered:
        experience_parts.append("\n".join(answered))
    experience_context = "\n\n".join(experience_parts) if experience_parts else None

    from app.services.content import generate_content

    try:
        content_result = await generate_content(
            template, data.title, data.word_count, data.tone,
            data.replacements or None, experience_context=experience_context,
            image_source=template.image_source,
            image_style_guidance=template.image_style_guidance,
            industry=template.industry,
        )
        return TestContentResponse(
            content_markdown=content_result.content_markdown,
            content_html=content_result.content_html,
            excerpt=content_result.excerpt,
            featured_image_url=content_result.featured_image_url,
            meta_title=content_result.meta_title,
            meta_description=content_result.meta_description,
            image_alt_text=content_result.image_alt_text,
            system_prompt_used=content_result.system_prompt_used,
            content_prompt_used=content_result.content_prompt_used,
            outline_used=content_result.outline_used,
        )
    except Exception as e:
        logger.error(f"Test content generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate content",
        )


@router.post("/{template_id}/test/content-stream")
async def test_content_stream(
    template_id: str,
    data: TestContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming endpoint for content generation with real-time progress."""
    from app.services.tier_limits import check_feature_access, check_image_source, get_effective_tier, require_active_subscription, TIER_LIMITS

    await require_active_subscription(current_user)

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    check_image_source(current_user, template.image_source)

    # Check web research tier access
    if template.web_research_enabled:
        check_feature_access(current_user, "web_research")

    # Look up tier-specific DALL-E quality
    user_tier = get_effective_tier(current_user)
    tier_limits = TIER_LIMITS.get(user_tier, {}) if user_tier else {}
    user_dalle_quality = tier_limits.get("dalle_quality") or "standard"

    # Build experience context (same logic as test_content)
    experience_parts = []
    if template.experience_notes and template.experience_notes.strip():
        experience_parts.append(template.experience_notes.strip())
    answered = [a for a in data.experience_answers if a.strip()]
    if answered:
        experience_parts.append("\n".join(answered))
    experience_context = "\n\n".join(experience_parts) if experience_parts else None

    queue: asyncio.Queue = asyncio.Queue()

    async def progress_callback(stage: str, step: int, total: int, message: str, **extra):
        payload = {"stage": stage, "step": step, "total": total, "message": message}
        payload.update(extra)
        await queue.put({
            "event": "progress",
            "data": payload,
        })

    async def run_generation():
        from app.services.content import generate_content
        try:
            content_result = await generate_content(
                template, data.title, data.word_count, data.tone,
                data.replacements or None, experience_context=experience_context,
                progress_callback=progress_callback,
                image_source=template.image_source,
                image_style_guidance=template.image_style_guidance,
                industry=template.industry,
                dalle_quality=user_dalle_quality,
                web_research_enabled=bool(template.web_research_enabled),
            )
            await queue.put({
                "event": "complete",
                "data": {
                    "content_markdown": content_result.content_markdown,
                    "content_html": content_result.content_html,
                    "excerpt": content_result.excerpt,
                    "featured_image_url": content_result.featured_image_url,
                    "meta_title": content_result.meta_title,
                    "meta_description": content_result.meta_description,
                    "image_alt_text": content_result.image_alt_text,
                    "faq_schema": content_result.faq_schema,
                    "system_prompt_used": content_result.system_prompt_used,
                    "content_prompt_used": content_result.content_prompt_used,
                    "outline_used": content_result.outline_used,
                },
            })
        except Exception as e:
            logger.error(f"SSE content generation failed: {e}")
            await queue.put({
                "event": "error",
                "data": {"detail": str(e)},
            })

    async def event_stream():
        task = asyncio.create_task(run_generation())
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


@router.post("/{template_id}/test/linkedin")
async def test_linkedin(
    template_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a LinkedIn post from test panel content (Tribune+ only)."""
    from app.services.tier_limits import check_feature_access
    from app.services.content import repurpose_to_linkedin

    check_feature_access(current_user, "repurpose_linkedin")

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )

    content_html = data.get("content_html")
    title = data.get("title")
    if not content_html or not title:
        raise HTTPException(status_code=400, detail="content_html and title are required")

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        linkedin_text = await repurpose_to_linkedin(
            content_html,
            title,
            industry=template.industry,
            template=template,
        )
    except Exception as exc:
        logger.error(f"LinkedIn test panel repurpose failed: {exc}")
        raise HTTPException(status_code=502, detail="LinkedIn post generation failed")

    has_voice = bool(
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
    return {"linkedin_post": linkedin_text, "voice_applied": has_voice}


@router.post("/{template_id}/test/youtube-script")
async def test_youtube_script(
    template_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a YouTube script from test panel content (Tribune+ only)."""
    from app.services.tier_limits import check_feature_access
    from app.services.content import repurpose_to_youtube_script

    check_feature_access(current_user, "repurpose_youtube_script")

    if await is_maintenance_mode(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI generation is paused — maintenance mode is active",
        )

    content_html = data.get("content_html")
    title = data.get("title")
    if not content_html or not title:
        raise HTTPException(status_code=400, detail="content_html and title are required")

    video_length = data.get("video_length", "long")
    if video_length not in ("short", "long"):
        raise HTTPException(status_code=400, detail="video_length must be 'short' or 'long'")

    result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.id == template_id,
            PromptTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        script_text = await repurpose_to_youtube_script(
            content_html,
            title,
            industry=template.industry,
            template=template,
            video_length=video_length,
        )
    except Exception as exc:
        logger.error(f"YouTube script test panel repurpose failed: {exc}")
        raise HTTPException(status_code=502, detail="YouTube script generation failed")

    has_voice = bool(
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
    return {
        "youtube_script": script_text,
        "video_length": video_length,
        "voice_applied": has_voice,
    }
