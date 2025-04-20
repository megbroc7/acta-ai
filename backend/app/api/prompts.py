from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.sql import delete
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, root_validator
from datetime import datetime
from sqlalchemy.sql import func

from ..core.database import get_db
from ..models.prompt_template import PromptTemplate
from ..models.user import User
from ..services.content import ContentGenerator
from .auth import get_current_user
import json

router = APIRouter()

# Pydantic models
class PlaceholderItem(BaseModel):
    name: str
    default_value: str
    description: str = None

class VariableItem(BaseModel):
    name: str
    key: str
    type: str
    description: str = None
    default_value: str = None
    options: List[str] = None

class PromptTemplateCreate(BaseModel):
    name: str
    description: str = None
    system_prompt: str
    topic_generation_prompt: str
    content_generation_prompt: str
    default_word_count: int = 1500
    default_tone: str = "informative"
    content_type: str = "blog_post"  # blog_post, article, tutorial, etc.
    writing_style: str = "standard"  # standard, casual, formal, academic, etc.
    industry: str = None  # finance, health, technology, etc.
    audience_level: str = "general"  # beginner, intermediate, advanced, general
    special_requirements: str = None  # Any special requirements or instructions
    placeholders: Dict[str, str] = {}
    variables: List[Dict[str, Any]] = []
    is_default: bool = False

class PromptTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    system_prompt: str
    topic_generation_prompt: str
    content_generation_prompt: str
    default_word_count: int
    default_tone: str
    content_type: Optional[str] = "blog_post"
    writing_style: Optional[str] = "standard"
    industry: Optional[str] = None
    audience_level: Optional[str] = "general"
    special_requirements: Optional[str] = None
    placeholders: Dict[str, str] = {}
    variables: List[Dict[str, Any]] = []
    is_default: bool
    created_at: str
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
        
    @root_validator(pre=True)
    def ensure_variables_is_list(cls, values):
        try:
            # Handle case where values is a model instance instead of a dict
            if hasattr(values, '__dict__') and not isinstance(values, dict):
                # If values is a model instance with a variables attribute
                if hasattr(values, 'variables'):
                    if values.variables is None:
                        values.variables = []
                # Handle datetime fields for model instances
                if hasattr(values, 'created_at') and values.created_at and not isinstance(values.created_at, str):
                    if isinstance(values.created_at, datetime):
                        values.created_at = values.created_at.isoformat()
                if hasattr(values, 'updated_at') and values.updated_at and not isinstance(values.updated_at, str):
                    if isinstance(values.updated_at, datetime):
                        values.updated_at = values.updated_at.isoformat()
                return values
            
            # Original dictionary-based logic
            if "variables" not in values:
                values["variables"] = []
            elif values["variables"] is None:
                values["variables"] = []
                
            # Handle datetime fields for dictionaries
            if "created_at" in values and values["created_at"] and not isinstance(values["created_at"], str):
                if isinstance(values["created_at"], datetime):
                    values["created_at"] = values["created_at"].isoformat()
            if "updated_at" in values and values["updated_at"] and not isinstance(values["updated_at"], str):
                if isinstance(values["updated_at"], datetime):
                    values["updated_at"] = values["updated_at"].isoformat()
            
            return values
        except Exception as e:
            # Log the error for debugging
            print(f"Error in ensure_variables_is_list validator: {str(e)}")
            print(f"Values type: {type(values)}")
            # Return values unchanged to prevent breaking the application
            return values

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
        "name": "Sample Blog Post Template",
        "description": "A complete template with guidance to help you create engaging blog posts using AI",
        "system_prompt": "You are a helpful blogging assistant who creates engaging, informative, and well-structured articles that are easy to read and understand. Your job is to make the blog post sound natural and conversational, as if written by a human expert who is passionate about the topic.",
        "topic_generation_prompt": """
        # Topic Generation Prompt
        # (This prompt helps the AI create a relevant title for your blog post)
        
        Please generate an interesting and engaging blog post title about {idea}.
        
        Make the title:
        - Clear and easy to understand
        - Appealing to readers interested in this topic
        - Between 40-60 characters long
        - Something that would make people want to click and read
        - Include a key benefit or solution if possible
        
        Examples of good titles:
        - "5 Easy Ways to Start Gardening in Small Spaces"
        - "How to Train Your Dog: A Beginner's Guide"
        - "Understanding Cryptocurrency: Simple Explanations"
        
        Return only the title without any additional text.
        """,
        "content_generation_prompt": """
        # Content Generation Prompt
        # (This prompt tells the AI how to structure and write your blog post)
        
        Write a {word_count}-word blog post about {topic} for {audience}.
        
        The tone should be {tone} and the article should include at least {num_examples} practical examples or tips.
        
        ## Structure the post as follows:
        
        ### INTRODUCTION (10-15% of total length):
        - Start with an engaging hook to capture reader interest
        - Explain why this topic matters to the reader
        - Briefly outline what the reader will learn
        
        ### MAIN CONTENT (70-80% of total length, 3-5 sections):
        - Use clear H2 headings for each main section
        - Include H3 subheadings for subsections if needed
        - Provide practical examples and actionable tips
        - Include real-world applications of the information
        - Use bullet points or numbered lists for easy scanning
        
        ### CONCLUSION (5-10% of total length):
        - Summarize the key points
        - Include a motivational final thought
        - Add a question or call-to-action to engage readers
        
        ## Formatting requirements:
        - Use Markdown formatting throughout
        - Use ## for H2 headings and ### for H3 headings
        - Use **bold text** for important points
        - Use *italic text* for emphasis
        - Use bullet lists and numbered lists where appropriate
        
        The content should be helpful, practical, and easy to understand, even for someone new to this topic. Avoid jargon when possible, or explain technical terms when they're necessary.
        
        ## TIP: To get the best results:
        - Be specific about your topic
        - For "Beginner" topics, focus on fundamentals and avoid complex concepts
        - For "Advanced" topics, include more technical details and expert techniques
        """,
        "default_word_count": 800,
        "default_tone": "friendly",
        "content_type": "blog_post",
        "writing_style": "conversational",
        "industry": "general",
        "audience_level": "beginner",
        "special_requirements": "Focus on being helpful and practical with real-world examples.",
        "placeholders": {
            "idea": "The general topic you want to write about (e.g., \"gardening tips\", \"beginner coding\", \"home organization\")",
            "topic": "The specific title or focus of your blog post (e.g., \"5 Easy Gardening Tips for Beginners\")",
            "word_count": "How long the article should be (800 is a good starting point)",
            "tone": "The writing style (friendly, professional, conversational, informative, etc.)",
            "audience": "Who you're writing for (e.g., \"beginners\", \"busy parents\", \"small business owners\")",
            "num_examples": "Number of examples to include (3-5 is usually good)"
        },
        "variables": [
            {
                "name": "Blog Idea",
                "key": "idea",
                "type": "text",
                "description": "The general topic you want to write about",
                "default_value": "gardening tips"
            },
            {
                "name": "Blog Topic",
                "key": "topic",
                "type": "text",
                "description": "The specific title or focus of your blog post",
                "default_value": "5 Easy Gardening Tips for Beginners"
            },
            {
                "name": "Target Audience",
                "key": "audience",
                "type": "text",
                "description": "Who you're writing for",
                "default_value": "beginners"
            },
            {
                "name": "Word Count",
                "key": "word_count",
                "type": "number",
                "description": "How long the article should be",
                "default_value": "800"
            },
            {
                "name": "Writing Tone",
                "key": "tone",
                "type": "select",
                "description": "The style and voice of the writing",
                "default_value": "friendly",
                "options": ["friendly", "professional", "conversational", "informative", "authoritative"]
            },
            {
                "name": "Number of Examples",
                "key": "num_examples",
                "type": "number",
                "description": "How many examples or tips to include",
                "default_value": "3"
            }
        ],
        "is_default": True
    }
]

@router.post("/", response_model=PromptTemplateResponse)
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
        content_type=template_data.content_type,
        writing_style=template_data.writing_style,
        industry=template_data.industry,
        audience_level=template_data.audience_level,
        special_requirements=template_data.special_requirements,
        placeholders=template_data.placeholders,
        variables=template_data.variables,
        is_default=template_data.is_default
    )
    
    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)
    
    return new_template

@router.put("/{template_id}", response_model=PromptTemplateResponse)
async def update_prompt_template(
    template_id: int,
    template_data: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing prompt template."""
    # Find the template
    result = await db.execute(
        select(PromptTemplate)
        .filter(PromptTemplate.id == template_id)
        .filter(PromptTemplate.user_id == current_user.id)
    )
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or you don't have permission to edit it"
        )
    
    # Update template fields
    template.name = template_data.name
    template.description = template_data.description
    template.system_prompt = template_data.system_prompt
    template.topic_generation_prompt = template_data.topic_generation_prompt
    template.content_generation_prompt = template_data.content_generation_prompt
    template.default_word_count = template_data.default_word_count
    template.default_tone = template_data.default_tone
    template.content_type = template_data.content_type
    template.writing_style = template_data.writing_style
    template.industry = template_data.industry
    template.audience_level = template_data.audience_level
    template.special_requirements = template_data.special_requirements
    template.placeholders = template_data.placeholders
    template.variables = template_data.variables
    template.is_default = template_data.is_default
    template.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(template)
    
    return template

@router.get("/", response_model=List[PromptTemplateResponse])
async def get_user_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all prompt templates for the user."""
    # Check if user has any templates
    result = await db.execute(
        select(PromptTemplate)
        .filter(PromptTemplate.user_id == current_user.id)
    )
    templates = result.scalars().all()
    
    # Initialize templates if needed
    if not templates:
        # User has no templates at all, create default ones
        templates_to_add = []
        
        for template_data in DEFAULT_TEMPLATES:
            template = PromptTemplate(
                user_id=current_user.id,
                **template_data
            )
            templates_to_add.append(template)
            db.add(template)
        
        if templates_to_add:
            await db.commit()
            
            for template in templates_to_add:
                await db.refresh(template)
            
            # Update templates list with newly created ones
            templates = templates_to_add
    
    # Convert datetime fields to strings for JSON serialization
    processed_templates = []
    for template in templates:
        template_dict = template.__dict__.copy()
        if template_dict.get('created_at'):
            template_dict['created_at'] = template_dict['created_at'].isoformat()
        if template_dict.get('updated_at'):
            template_dict['updated_at'] = template_dict['updated_at'].isoformat()
        processed_templates.append(template_dict)
    
    return processed_templates

@router.get("/{template_id}", response_model=PromptTemplateResponse)
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
    
    # Convert datetime fields to strings
    template_dict = template.__dict__.copy()
    if template_dict.get('created_at'):
        template_dict['created_at'] = template_dict['created_at'].isoformat()
    if template_dict.get('updated_at'):
        template_dict['updated_at'] = template_dict['updated_at'].isoformat()
    
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

@router.post("/reset-templates", response_model=List[PromptTemplateResponse])
async def reset_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all existing templates and recreate the default ones for the user."""
    # Delete all user's existing templates
    delete_stmt = delete(PromptTemplate).where(PromptTemplate.user_id == current_user.id)
    await db.execute(delete_stmt)
    await db.commit()
    
    # Create new default templates
    new_templates = []
    for template_data in DEFAULT_TEMPLATES:
        template = PromptTemplate(
            user_id=current_user.id,
            **template_data
        )
        db.add(template)
        new_templates.append(template)
    
    await db.commit()
    
    # Refresh and prepare response
    processed_templates = []
    for template in new_templates:
        await db.refresh(template)
        template_dict = template.__dict__.copy()
        if template_dict.get('created_at'):
            template_dict['created_at'] = template_dict['created_at'].isoformat()
        if template_dict.get('updated_at'):
            template_dict['updated_at'] = template_dict['updated_at'].isoformat()
        processed_templates.append(template_dict)
    
    return processed_templates

@router.post("/cleanup-duplicates", response_model=dict)
async def cleanup_duplicate_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove duplicate templates while keeping the most recently updated one."""
    # Get all template names with count > 1 for this user
    query = select(
        PromptTemplate.name, 
        func.count(PromptTemplate.id).label('count')
    ).filter(
        PromptTemplate.user_id == current_user.id
    ).group_by(
        PromptTemplate.name
    ).having(
        func.count(PromptTemplate.id) > 1
    )
    
    result = await db.execute(query)
    duplicate_names = result.all()
    
    if not duplicate_names:
        return {"message": "No duplicate templates found", "count": 0}
    
    # For each duplicate name, keep the most recently updated template
    deleted_count = 0
    for name_row in duplicate_names:
        template_name = name_row[0]
        
        # Get all templates with this name ordered by updated_at (newest first)
        query = select(PromptTemplate).filter(
            PromptTemplate.user_id == current_user.id,
            PromptTemplate.name == template_name
        ).order_by(
            PromptTemplate.updated_at.desc().nulls_last(),
            PromptTemplate.created_at.desc(),
            PromptTemplate.id.desc()
        )
        
        result = await db.execute(query)
        templates = result.scalars().all()
        
        # Keep the first one (most recently updated), delete the rest
        for template in templates[1:]:
            await db.delete(template)
            deleted_count += 1
    
    # Commit changes
    await db.commit()
    
    return {
        "message": f"Successfully removed {deleted_count} duplicate templates",
        "count": deleted_count
    }

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a prompt template by ID."""
    # Find the template
    query = select(PromptTemplate).filter(
        PromptTemplate.id == template_id,
        PromptTemplate.user_id == current_user.id
    )
    result = await db.execute(query)
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or you don't have permission to delete it"
        )
    
    # Delete the template
    await db.delete(template)
    await db.commit()
    
    return None

@router.post("/{template_id}/duplicate", response_model=PromptTemplateResponse)
async def duplicate_prompt_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Duplicate a prompt template by ID."""
    # Find the template to duplicate
    query = select(PromptTemplate).filter(
        PromptTemplate.id == template_id,
        PromptTemplate.user_id == current_user.id
    )
    result = await db.execute(query)
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found or you don't have permission to duplicate it"
        )
    
    # Create a new template with copied data
    duplicate_template = PromptTemplate(
        user_id=current_user.id,
        name=f"{template.name} (Copy)",
        description=template.description,
        system_prompt=template.system_prompt,
        topic_generation_prompt=template.topic_generation_prompt,
        content_generation_prompt=template.content_generation_prompt,
        default_word_count=template.default_word_count,
        default_tone=template.default_tone,
        placeholders=template.placeholders,
        variables=template.variables,
        is_default=False  # Duplicates are never default templates
    )
    
    # Add and commit to database
    db.add(duplicate_template)
    await db.commit()
    await db.refresh(duplicate_template)
    
    return duplicate_template 