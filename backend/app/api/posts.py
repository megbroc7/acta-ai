from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from ..core.database import get_db
from ..models.blog_schedule import BlogPost
from ..models.user import User
from ..models.site import WordPressSite
from ..services.wordpress import WordPressService
from ..services.content import ContentGenerator
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class PostCreate(BaseModel):
    site_id: int
    title: str
    content: str
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    category_ids: List[int] = []
    tag_ids: List[int] = []
    status: str = "draft"  # draft, publish

class PostResponse(BaseModel):
    id: int
    site_id: int
    wp_id: Optional[int] = None
    title: str
    content: str
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    category_ids: List[int]
    tag_ids: List[int]
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    wp_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None
    status: Optional[str] = None

@router.post("/", response_model=PostResponse)
async def create_post(
    post_data: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new blog post."""
    # Verify site exists and belongs to user
    stmt = select(WordPressSite).where(
        (WordPressSite.id == post_data.site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Create post in database
    new_post = BlogPost(
        user_id=current_user.id,
        site_id=post_data.site_id,
        title=post_data.title,
        content=post_data.content,
        excerpt=post_data.excerpt or ContentGenerator().extract_excerpt(post_data.content),
        featured_image_url=post_data.featured_image_url,
        category_ids=post_data.category_ids,
        tag_ids=post_data.tag_ids,
        status=post_data.status
    )
    
    # If status is publish, publish to WordPress
    if post_data.status == "publish":
        wp_service = WordPressService(
            api_url=site.api_url,
            username=site.username,
            app_password=site.app_password
        )
        
        # Publish to WordPress
        result = await wp_service.create_post(
            title=post_data.title,
            content=post_data.content,
            excerpt=new_post.excerpt,
            featured_image_url=post_data.featured_image_url,
            category_ids=post_data.category_ids,
            tag_ids=post_data.tag_ids,
            status="publish"
        )
        
        if result["success"]:
            new_post.wp_id = result["post_id"]
            new_post.wp_url = result["post_url"]
            new_post.published_at = datetime.utcnow()
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to publish to WordPress: {result.get('error', 'Unknown error')}"
            )
    
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)
    
    return new_post

@router.get("/", response_model=List[PostResponse])
async def get_posts(
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all blog posts for the current user, optionally filtered by site and status."""
    query = select(BlogPost).where(BlogPost.user_id == current_user.id)
    
    if site_id:
        query = query.where(BlogPost.site_id == site_id)
    
    if status:
        query = query.where(BlogPost.status == status)
    
    result = await db.execute(query)
    posts = result.scalars().all()
    
    return posts

@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog post."""
    stmt = select(BlogPost).where(
        (BlogPost.id == post_id) &
        (BlogPost.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    return post

@router.patch("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    post_data: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a blog post."""
    stmt = select(BlogPost).where(
        (BlogPost.id == post_id) &
        (BlogPost.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    # Get site information
    stmt = select(WordPressSite).where(WordPressSite.id == post.site_id)
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    # Update post fields
    update_data = post_data.dict(exclude_unset=True)
    
    # If excerpt is not provided but content is updated, generate new excerpt
    if "content" in update_data and "excerpt" not in update_data:
        update_data["excerpt"] = ContentGenerator().extract_excerpt(update_data["content"])
    
    # Check if we're publishing a draft
    publishing = post.status == "draft" and update_data.get("status") == "publish"
    
    # Update the post
    for key, value in update_data.items():
        setattr(post, key, value)
    
    post.updated_at = datetime.utcnow()
    
    # If publishing or updating a published post, update on WordPress
    if publishing or (post.status == "publish" and post.wp_id):
        wp_service = WordPressService(
            api_url=site.api_url,
            username=site.username,
            app_password=site.app_password
        )
        
        if publishing:
            # Publish to WordPress
            result = await wp_service.create_post(
                title=post.title,
                content=post.content,
                excerpt=post.excerpt,
                featured_image_url=post.featured_image_url,
                category_ids=post.category_ids,
                tag_ids=post.tag_ids,
                status="publish"
            )
            
            if result["success"]:
                post.wp_id = result["post_id"]
                post.wp_url = result["post_url"]
                post.published_at = datetime.utcnow()
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to publish to WordPress: {result.get('error', 'Unknown error')}"
                )
        else:
            # Update existing WordPress post
            result = await wp_service.update_post(
                post_id=post.wp_id,
                title=post.title,
                content=post.content,
                excerpt=post.excerpt,
                featured_image_url=post.featured_image_url,
                category_ids=post.category_ids,
                tag_ids=post.tag_ids
            )
            
            if not result["success"]:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to update WordPress post: {result.get('error', 'Unknown error')}"
                )
    
    await db.commit()
    await db.refresh(post)
    
    return post

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a blog post."""
    stmt = select(BlogPost).where(
        (BlogPost.id == post_id) &
        (BlogPost.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    # If post was published to WordPress, delete it there too
    if post.wp_id:
        # Get site information
        stmt = select(WordPressSite).where(WordPressSite.id == post.site_id)
        result = await db.execute(stmt)
        site = result.scalars().first()
        
        wp_service = WordPressService(
            api_url=site.api_url,
            username=site.username,
            app_password=site.app_password
        )
        
        # Delete from WordPress
        result = await wp_service.delete_post(post.wp_id)
        if not result["success"]:
            # Log error but continue with local deletion
            print(f"Failed to delete WordPress post: {result.get('error', 'Unknown error')}")
    
    # Delete from database
    await db.delete(post)
    await db.commit()

@router.post("/{post_id}/publish", response_model=PostResponse)
async def publish_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Publish a draft blog post to WordPress."""
    stmt = select(BlogPost).where(
        (BlogPost.id == post_id) &
        (BlogPost.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    if post.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post is already published"
        )
    
    # Get site information
    stmt = select(WordPressSite).where(WordPressSite.id == post.site_id)
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    wp_service = WordPressService(
        api_url=site.api_url,
        username=site.username,
        app_password=site.app_password
    )
    
    # Publish to WordPress
    result = await wp_service.create_post(
        title=post.title,
        content=post.content,
        excerpt=post.excerpt,
        featured_image_url=post.featured_image_url,
        category_ids=post.category_ids,
        tag_ids=post.tag_ids,
        status="publish"
    )
    
    if result["success"]:
        post.wp_id = result["post_id"]
        post.wp_url = result["post_url"]
        post.status = "publish"
        post.published_at = datetime.utcnow()
        post.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(post)
        
        return post
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish to WordPress: {result.get('error', 'Unknown error')}"
        ) 