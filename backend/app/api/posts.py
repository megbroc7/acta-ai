from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from sqlalchemy.orm import joinedload
import re

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
    category_ids: List[int] = []
    tag_ids: List[int] = []
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    wp_url: Optional[str] = None
    site: Optional[dict] = None  # Add site information
    
    model_config = ConfigDict(
        from_attributes=True
    )

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None
    status: Optional[str] = None

class PostPreview(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None
    featured_image_url: Optional[str] = None
    category_ids: List[int] = []
    tag_ids: List[int] = []
    status: str = "draft"

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
    
    # Clean title formatting
    title = post_data.title.strip('"\'')
    # Remove Markdown heading symbols (# followed by space) from the beginning of titles
    title = re.sub(r'^#+\s*', '', title)
    title = re.sub(r'\s+', ' ', title)
    
    # Create content generator and get excerpt if needed
    content_generator = ContentGenerator()
    excerpt = post_data.excerpt or content_generator.extract_excerpt(post_data.content)
    
    # Create post in database
    new_post = BlogPost(
        user_id=current_user.id,
        site_id=post_data.site_id,
        title=title,
        content=post_data.content,
        excerpt=excerpt,
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
        
        # Format content for WordPress
        formatted_content = content_generator.format_content_for_wordpress(post_data.content)
        
        # Publish to WordPress
        result = await wp_service.create_post(
            title=title,
            content=formatted_content,
            excerpt=new_post.excerpt,
            featured_image_url=post_data.featured_image_url,
            category_ids=post_data.category_ids,
            tag_ids=post_data.tag_ids,
            status="publish"
        )
        
        if result["success"]:
            new_post.wordpress_id = result["post_id"]
            new_post.wordpress_url = result["post_url"]
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
    schedule_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all blog posts for the current user, optionally filtered by site, schedule, and status."""
    query = select(BlogPost).options(joinedload(BlogPost.site)).where(BlogPost.user_id == current_user.id)
    
    if site_id:
        query = query.where(BlogPost.site_id == site_id)
    
    if schedule_id:
        query = query.where(BlogPost.schedule_id == schedule_id)
    
    if status:
        query = query.where(BlogPost.status == status)
    
    result = await db.execute(query)
    db_posts = result.scalars().all()
    
    # Transform database models to Pydantic models manually
    posts = []
    for db_post in db_posts:
        site_info = None
        if db_post.site:
            site_info = {
                "id": db_post.site.id,
                "name": db_post.site.name,
                "url": db_post.site.url
            }
            
        post_dict = {
            "id": db_post.id,
            "site_id": db_post.site_id,
            "wp_id": db_post.wordpress_id,
            "title": db_post.title,
            "content": db_post.content,
            "excerpt": db_post.excerpt,
            "featured_image_url": db_post.featured_image_url,
            "category_ids": db_post.categories if db_post.categories is not None else [],
            "tag_ids": db_post.tags if db_post.tags is not None else [],
            "status": db_post.status,
            "created_at": db_post.created_at,
            "updated_at": None,
            "published_at": db_post.published_at,
            "wp_url": db_post.wordpress_url,
            "site": site_info
        }
        posts.append(PostResponse(**post_dict))
    
    return posts

@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog post."""
    stmt = select(BlogPost).options(joinedload(BlogPost.site)).where(
        (BlogPost.id == post_id) &
        (BlogPost.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    db_post = result.scalars().first()
    
    if not db_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    # Create site info if available
    site_info = None
    if db_post.site:
        site_info = {
            "id": db_post.site.id,
            "name": db_post.site.name,
            "url": db_post.site.url
        }
    
    # Transform database model to Pydantic model manually
    post_dict = {
        "id": db_post.id,
        "site_id": db_post.site_id,
        "wp_id": db_post.wordpress_id,
        "title": db_post.title,
        "content": db_post.content,
        "excerpt": db_post.excerpt,
        "featured_image_url": db_post.featured_image_url,
        "category_ids": db_post.categories if db_post.categories is not None else [],
        "tag_ids": db_post.tags if db_post.tags is not None else [],
        "status": db_post.status,
        "created_at": db_post.created_at,
        "updated_at": None,
        "published_at": db_post.published_at,
        "wp_url": db_post.wordpress_url,
        "site": site_info
    }
    
    return PostResponse(**post_dict)

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
    
    # Create content generator for any formatting needs
    content_generator = ContentGenerator()
    
    # If excerpt is not provided but content is updated, generate new excerpt
    if "content" in update_data and "excerpt" not in update_data:
        update_data["excerpt"] = content_generator.extract_excerpt(update_data["content"])
    
    # Clean title if it's being updated
    if "title" in update_data:
        update_data["title"] = update_data["title"].strip('"\'')
        # Remove Markdown heading symbols (# followed by space) from the beginning of titles
        update_data["title"] = re.sub(r'^#+\s*', '', update_data["title"])
        update_data["title"] = re.sub(r'\s+', ' ', update_data["title"])
    
    # Check if we're publishing a draft
    publishing = post.status == "draft" and update_data.get("status") == "publish"
    
    # Update the post
    for key, value in update_data.items():
        setattr(post, key, value)
    
    post.updated_at = datetime.utcnow()
    
    # If publishing or updating a published post, update on WordPress
    if publishing or (post.status == "publish" and post.wordpress_id):
        wp_service = WordPressService(
            api_url=site.api_url,
            username=site.username,
            app_password=site.app_password
        )
        
        # Format content for WordPress
        formatted_content = content_generator.format_content_for_wordpress(post.content)
        
        if publishing:
            # Publish to WordPress
            result = await wp_service.create_post(
                title=post.title,
                content=formatted_content,
                excerpt=post.excerpt,
                featured_image_url=post.featured_image_url,
                category_ids=post.category_ids,
                tag_ids=post.tag_ids,
                status="publish"
            )
            
            if result["success"]:
                post.wordpress_id = result["post_id"]
                post.wordpress_url = result["post_url"]
                post.published_at = datetime.utcnow()
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to publish to WordPress: {result.get('error', 'Unknown error')}"
                )
        else:
            # Update existing WordPress post
            result = await wp_service.update_post(
                post_id=post.wordpress_id,
                title=post.title,
                content=formatted_content,
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
    
    # Create site info dict for response
    site_info = None
    if site:
        site_info = {
            "id": site.id,
            "name": site.name,
            "url": site.url
        }
    
    # Create a PostResponse with properly formatted data
    post_dict = {
        "id": post.id,
        "site_id": post.site_id,
        "wp_id": post.wordpress_id,
        "title": post.title,
        "content": post.content,
        "excerpt": post.excerpt,
        "featured_image_url": post.featured_image_url,
        "category_ids": post.categories if post.categories is not None else [],
        "tag_ids": post.tags if post.tags is not None else [],
        "status": post.status,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "published_at": post.published_at,
        "wp_url": post.wordpress_url,
        "site": site_info
    }
    
    return PostResponse(**post_dict)

@router.put("/{post_id}", response_model=PostResponse)
async def update_post_put(
    post_id: int,
    post_data: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a blog post with PUT method."""
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
    
    # Prepare update data
    update_data = {}
    
    # Create content generator for formatting needs
    content_generator = ContentGenerator()
    
    # Copy basic fields
    if post_data.title is not None:
        title = post_data.title.strip('"\'')
        # Remove Markdown heading symbols (# followed by space) from the beginning of titles
        title = re.sub(r'^#+\s*', '', title)
        title = re.sub(r'\s+', ' ', title)
        update_data["title"] = title
    
    if post_data.content is not None:
        update_data["content"] = post_data.content
        # If excerpt is not provided but content is updated, generate new excerpt
        if post_data.excerpt is None:
            update_data["excerpt"] = content_generator.extract_excerpt(post_data.content)
    
    if post_data.excerpt is not None:
        update_data["excerpt"] = post_data.excerpt
    
    if post_data.featured_image_url is not None:
        update_data["featured_image_url"] = post_data.featured_image_url
        
    if post_data.category_ids is not None:
        update_data["category_ids"] = post_data.category_ids
        
    if post_data.tag_ids is not None:
        update_data["tag_ids"] = post_data.tag_ids
        
    if post_data.status is not None:
        update_data["status"] = post_data.status
    
    # Check if we're publishing a draft
    publishing = post.status == "draft" and update_data.get("status") == "publish"
    
    # Update the post
    for key, value in update_data.items():
        setattr(post, key, value)
    
    post.updated_at = datetime.utcnow()
    
    # If publishing or updating a published post, update on WordPress
    if publishing or (post.status == "publish" and post.wordpress_id):
        wp_service = WordPressService(
            api_url=site.api_url,
            username=site.username,
            app_password=site.app_password
        )
        
        # Format content for WordPress
        formatted_content = content_generator.format_content_for_wordpress(post.content)
        
        if publishing:
            # Publish to WordPress
            result = await wp_service.create_post(
                title=post.title,
                content=formatted_content,
                excerpt=post.excerpt,
                featured_image_url=post.featured_image_url,
                category_ids=post.category_ids,
                tag_ids=post.tag_ids,
                status="publish"
            )
            
            if result["success"]:
                post.wordpress_id = result["post_id"]
                post.wordpress_url = result["post_url"]
                post.published_at = datetime.utcnow()
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to publish to WordPress: {result.get('error', 'Unknown error')}"
                )
        else:
            # Update existing WordPress post
            result = await wp_service.update_post(
                post_id=post.wordpress_id,
                title=post.title,
                content=formatted_content,
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
    
    # Create site info dict for response
    site_info = None
    if site:
        site_info = {
            "id": site.id,
            "name": site.name,
            "url": site.url
        }
    
    # Create a PostResponse with properly formatted data
    post_dict = {
        "id": post.id,
        "site_id": post.site_id,
        "wp_id": post.wordpress_id,
        "title": post.title,
        "content": post.content,
        "excerpt": post.excerpt,
        "featured_image_url": post.featured_image_url,
        "category_ids": post.categories if post.categories is not None else [],
        "tag_ids": post.tags if post.tags is not None else [],
        "status": post.status,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "published_at": post.published_at,
        "wp_url": post.wordpress_url,
        "site": site_info
    }
    
    return PostResponse(**post_dict)

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
    if post.wordpress_id:
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
        result = await wp_service.delete_post(post.wordpress_id)
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
    
    # Format content for WordPress - use the ContentGenerator to properly format
    content_generator = ContentGenerator()
    formatted_content = content_generator.format_content_for_wordpress(post.content)
    
    wp_service = WordPressService(
        api_url=site.api_url,
        username=site.username,
        app_password=site.app_password
    )
    
    # Prepare post data as a dictionary
    post_data = {
        "title": post.title,
        "content": formatted_content,
        "status": "publish"
    }
    
    # Add optional fields only if they exist
    if post.excerpt:
        post_data["excerpt"] = post.excerpt
    if post.featured_image_url:
        post_data["featured_image_url"] = post.featured_image_url
    if post.categories:
        post_data["category_ids"] = post.categories  # Using correct field name
    if post.tags:
        post_data["tag_ids"] = post.tags  # Using correct field name
    
    # Publish to WordPress
    result = await wp_service.create_post(post_data)
    
    if result["success"]:
        # Access the correct fields from the WordPress API response
        wp_response = result["data"]
        post.wordpress_id = wp_response.get("id")
        post.wordpress_url = wp_response.get("link")
        post.status = "publish"
        post.published_at = datetime.utcnow()
        post.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(post)
        
        # Create site info dict for response
        site_info = None
        if site:
            site_info = {
                "id": site.id,
                "name": site.name,
                "url": site.url
            }
        
        # Create a PostResponse with properly formatted data
        post_dict = {
            "id": post.id,
            "site_id": post.site_id,
            "wp_id": post.wordpress_id,
            "title": post.title,
            "content": post.content,
            "excerpt": post.excerpt,
            "featured_image_url": post.featured_image_url,
            "category_ids": post.categories if post.categories is not None else [],
            "tag_ids": post.tags if post.tags is not None else [],
            "status": post.status,
            "created_at": post.created_at,
            "updated_at": post.updated_at,
            "published_at": post.published_at,
            "wp_url": post.wordpress_url,
            "site": site_info
        }
        
        return PostResponse(**post_dict)
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish to WordPress: {result.get('error', 'Unknown error')}"
        )

@router.post("/{post_id}/preview", response_model=PostResponse)
async def preview_post(
    post_id: int,
    post_data: PostPreview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Preview a post with temporary changes without saving to database."""
    # First get the existing post to ensure the user has access
    stmt = select(BlogPost).where(
        (BlogPost.id == post_id) &
        (BlogPost.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    existing_post = result.scalars().first()
    
    if not existing_post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blog post not found"
        )
    
    # Get site information
    stmt = select(WordPressSite).where(WordPressSite.id == existing_post.site_id)
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    # Create a preview response that merges existing post with new data
    site_info = None
    if site:
        site_info = {
            "id": site.id,
            "name": site.name,
            "url": site.url
        }
    
    # If excerpt is not provided but content is, generate new excerpt
    excerpt = post_data.excerpt
    if not excerpt and post_data.content:
        excerpt = ContentGenerator().extract_excerpt(post_data.content)
    
    # Clean title formatting
    title = post_data.title.strip('"\'')
    # Remove Markdown heading symbols (# followed by space) from the beginning of titles
    title = re.sub(r'^#+\s*', '', title)
    title = re.sub(r'\s+', ' ', title)
    
    # Create response with updated fields but keep database fields intact
    post_dict = {
        "id": existing_post.id,
        "site_id": existing_post.site_id,
        "wp_id": existing_post.wordpress_id,
        "title": title,
        "content": post_data.content,
        "excerpt": excerpt,
        "featured_image_url": post_data.featured_image_url or existing_post.featured_image_url,
        "category_ids": post_data.category_ids or (existing_post.categories or []),
        "tag_ids": post_data.tag_ids or (existing_post.tags or []),
        "status": post_data.status,
        "created_at": existing_post.created_at,
        "updated_at": datetime.utcnow(),
        "published_at": existing_post.published_at,
        "wp_url": existing_post.wordpress_url,
        "site": site_info
    }
    
    # Return the preview without saving to database
    return PostResponse(**post_dict) 