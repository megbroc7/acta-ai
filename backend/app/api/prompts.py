from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime

from ..core.database import get_db
from ..models.prompt_template import PromptTemplate
from ..models.user import User
from ..services.content import ContentGenerator
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class PlaceholderItem(BaseModel):
    name: str
    default_value: str
    description: str = None

class PromptTemplateCreate(BaseModel):
    name: str
    description: str = None
    system_prompt: str
    topic_generation_prompt: str
    content_generation_prompt: str
    default_word_count: int = 1500
    default_tone: str = "informative"
    placeholders: Dict[str, str] = {}
    is_default: bool = False

class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    description: str = None
    system_prompt: str
    topic_generation_prompt: str
    content_generation_prompt: str
    default_word_count: int
    default_tone: str
    placeholders: Dict[str, str] = {}
    is_default: bool
    created_at: Any
    updated_at: Optional[Any] = None
    
    @validator('created_at', 'updated_at', pre=True)
    def parse_datetime(cls, value):
        if isinstance(value, datetime):
            return value.isoformat()
        return value

class TestTopicRequest(BaseModel):
    prompt_template_id: Optional[int] = None
    system_prompt: Optional[str] = None
    topic_generation_prompt: Optional[str] = None
    idea: str
    replacements: Dict[str, Any] = {}

class TestTopicResponse(BaseModel):
    topic: str
    prompt_used: str

class TestContentRequest(BaseModel):
    prompt_template_id: Optional[int] = None
    system_prompt: Optional[str] = None
    content_generation_prompt: Optional[str] = None
    topic: str
    word_count: int = 1500
    tone: str = "informative"
    replacements: Dict[str, Any] = {}

class TestContentResponse(BaseModel):
    content: str
    html_content: str
    prompt_used: str
    excerpt: str

# Default templates
DEFAULT_TEMPLATES = [
    {
        "name": "Standard Blog Post",
        "description": "A general-purpose blog post template suitable for most topics",
        "system_prompt": "You are a professional content creator who specializes in creating engaging, informative, and valuable blog posts.",
        "topic_generation_prompt": """
        Generate a unique, search-optimized blog post topic about {idea}.
        
        The topic should be practical, useful, and appealing to readers interested in this subject.
        
        Return only the title as plain text, without quotes or additional commentary.
        """,
        "content_generation_prompt": """
        Write a {word_count}-word search-optimized blog post about {topic}.
        
        The tone should be {tone} and the article should be educational and easy to understand.
        
        Key Guidelines:
        - Start with an engaging introduction
        - Include practical examples and applications
        - Use structured sections with clear headings (H2, H3)
        - Include actionable advice or steps readers can take
        - End with a concise conclusion
        
        Format the content using Markdown, including:
        - Proper headings (## for H2, ### for H3)
        - Bullet points and numbered lists where appropriate
        - Bold or italic text for emphasis
        - Tables if relevant to present information clearly
        
        Do not include placeholder text, lorem ipsum, or a sign-off.
        """,
        "default_word_count": 1200,
        "default_tone": "conversational",
        "placeholders": {
            "idea": "your topic",
            "topic": "your specific blog title",
            "word_count": "1200",
            "tone": "conversational"
        },
        "is_default": True
    },
    {
        "name": "SEO-Focused Article",
        "description": "Template optimized for search engine visibility with stronger keyword focus",
        "system_prompt": "You are an SEO specialist and content writer who creates highly optimized articles that rank well in search engines while providing value to readers.",
        "topic_generation_prompt": """
        Generate a search-optimized blog post title about {idea}.
        
        The title should:
        - Be engaging and click-worthy
        - Include relevant keywords
        - Be between 50-60 characters long
        - Clearly communicate the value to the reader
        
        Return only the title without quotes or additional commentary.
        """,
        "content_generation_prompt": """
        Write a {word_count}-word SEO-optimized blog post about {topic}.
        
        Use a {tone} tone and focus on creating content that will rank well in search engines.
        
        Content structure:
        1. Start with an engaging introduction that includes the primary keyword
        2. Break the content into 4-7 subsections with clear H2 headings
        3. Use H3 subheadings for deeper sections when needed
        4. Include a numbered list or step-by-step process
        5. Add a FAQ section with 3-5 common questions about the topic
        6. End with a call-to-action conclusion
        
        SEO guidelines:
        - Use the primary keyword in the first paragraph
        - Include semantic keywords throughout
        - Keep paragraphs short (3-4 sentences maximum)
        - Use bullet points and numbered lists for scannability
        - Include transition phrases between sections
        
        Format using Markdown syntax and ensure all content is original and valuable to readers.
        """,
        "default_word_count": 1500,
        "default_tone": "informative",
        "placeholders": {
            "idea": "your topic",
            "topic": "your specific blog title",
            "word_count": "1500",
            "tone": "informative"
        },
        "is_default": True
    }
]

@router.post("/templates", response_model=PromptTemplateResponse)
async def create_prompt_template(
    template_data: PromptTemplateCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new prompt template."""
    new_template = PromptTemplate(
        user_id=current_user.id,
        name=template_data.name,
        description=template_data.description,
        system_prompt=template_data.system_prompt,
        topic_generation_prompt=template_data.topic_generation_prompt,
        content_generation_prompt=template_data.content_generation_prompt,
        default_word_count=template_data.default_word_count,
        default_tone=template_data.default_tone,
        placeholders=template_data.placeholders,
        is_default=template_data.is_default
    )
    
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    
    return new_template

@router.get("/templates", response_model=List[PromptTemplateResponse])
async def get_user_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all prompt templates for the current user."""
    stmt = select(PromptTemplate).where(PromptTemplate.user_id == current_user.id)
    result = await db.execute(stmt)
    user_templates = result.scalars().all()
    
    # Also get default templates if user doesn't have them yet
    default_templates = []
    if not any(t.is_default for t in user_templates):
        # Initialize default templates for this user
        for template_data in DEFAULT_TEMPLATES:
            template = PromptTemplate(
                user_id=current_user.id,
                **template_data
            )
            db.add(template)
            default_templates.append(template)
        
        await db.commit()
        for template in default_templates:
            await db.refresh(template)
    
    return user_templates + default_templates

@router.get("/templates/{template_id}", response_model=PromptTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific prompt template."""
    stmt = select(PromptTemplate).where(
        (PromptTemplate.id == template_id) & 
        (PromptTemplate.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return template

@router.get("/templates/{template_id}/debug", response_model=dict)
async def debug_template(
    template_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint to check template data."""
    stmt = select(PromptTemplate).where(PromptTemplate.id == template_id)
    result = await db.execute(stmt)
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Convert to dict for debugging
    template_dict = {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "system_prompt": template.system_prompt,
        "topic_generation_prompt": template.topic_generation_prompt,
        "content_generation_prompt": template.content_generation_prompt,
        "default_word_count": template.default_word_count,
        "default_tone": template.default_tone,
        "placeholders": template.placeholders,
        "is_default": template.is_default,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }
    
    return template_dict

@router.post("/test/topic", response_model=TestTopicResponse)
async def test_topic_generation(
    request: TestTopicRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test topic generation with a prompt template or custom prompts."""
    content_generator = ContentGenerator()
    
    # Get prompt template if specified
    template = None
    if request.prompt_template_id:
        stmt = select(PromptTemplate).where(
            (PromptTemplate.id == request.prompt_template_id) & 
            (PromptTemplate.user_id == current_user.id)
        )
        result = await db.execute(stmt)
        template = result.scalars().first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
    
    # Use custom prompts if provided, otherwise use template
    if template:
        topic, prompt_used = await content_generator.generate_blog_topic(
            idea=request.idea,
            prompt_template=template,
            custom_replacements=request.replacements
        )
    elif request.system_prompt and request.topic_generation_prompt:
        # Create temporary template
        temp_template = PromptTemplate(
            user_id=current_user.id,
            name="Temporary Template",
            system_prompt=request.system_prompt,
            topic_generation_prompt=request.topic_generation_prompt,
            content_generation_prompt="",  # Not used for topic generation
            default_word_count=1500,
            default_tone="informative"
        )
        topic, prompt_used = await content_generator.generate_blog_topic(
            idea=request.idea,
            prompt_template=temp_template,
            custom_replacements=request.replacements
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either prompt_template_id or both system_prompt and topic_generation_prompt must be provided"
        )
    
    return {"topic": topic, "prompt_used": prompt_used}

@router.post("/test/content", response_model=TestContentResponse)
async def test_content_generation(
    request: TestContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test blog content generation with a prompt template or custom prompts."""
    content_generator = ContentGenerator()
    
    # Get prompt template if specified
    template = None
    if request.prompt_template_id:
        stmt = select(PromptTemplate).where(
            (PromptTemplate.id == request.prompt_template_id) & 
            (PromptTemplate.user_id == current_user.id)
        )
        result = await db.execute(stmt)
        template = result.scalars().first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
    
    # Add word count and tone to replacements
    replacements = request.replacements.copy()
    replacements["word_count"] = request.word_count
    replacements["tone"] = request.tone
    
    # Use custom prompts if provided, otherwise use template
    if template:
        content, prompt_used = await content_generator.generate_blog_post(
            topic=request.topic,
            prompt_template=template,
            custom_replacements=replacements
        )
    elif request.system_prompt and request.content_generation_prompt:
        # Create temporary template
        temp_template = PromptTemplate(
            user_id=current_user.id,
            name="Temporary Template",
            system_prompt=request.system_prompt,
            topic_generation_prompt="",  # Not used for content generation
            content_generation_prompt=request.content_generation_prompt,
            default_word_count=request.word_count,
            default_tone=request.tone
        )
        content, prompt_used = await content_generator.generate_blog_post(
            topic=request.topic,
            prompt_template=temp_template,
            custom_replacements=replacements
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either prompt_template_id or both system_prompt and content_generation_prompt must be provided"
        )
    
    # Format content and extract excerpt
    html_content = content_generator.format_content_for_wordpress(content)
    excerpt = content_generator.extract_excerpt(content)
    
    return {
        "content": content,
        "html_content": html_content,
        "prompt_used": prompt_used,
        "excerpt": excerpt
    } 