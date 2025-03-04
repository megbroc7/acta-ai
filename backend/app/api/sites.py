from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, HttpUrl, Field

from ..core.database import get_db
from ..models.site import WordPressSite, Category, Tag
from ..models.user import User
from ..services.wordpress import WordPressService
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class CategoryResponse(BaseModel):
    id: int
    wp_id: int
    name: str

class TagResponse(BaseModel):
    id: int
    wp_id: int
    name: str

class WordPressSiteCreate(BaseModel):
    name: str
    url: HttpUrl
    api_url: HttpUrl
    username: str
    app_password: str

class WordPressSiteResponse(BaseModel):
    id: int
    name: str
    url: str
    api_url: str
    username: str
    created_at: str
    
class WordPressSiteDetail(WordPressSiteResponse):
    categories: List[CategoryResponse]
    tags: List[TagResponse]

class ConnectionTestRequest(BaseModel):
    api_url: HttpUrl
    username: str
    app_password: str

class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    user_info: Optional[Dict[str, Any]] = None

# Helper functions
async def fetch_and_save_taxonomies(
    db: AsyncSession, site_id: int, wp_service: WordPressService
):
    """Fetch categories and tags from WordPress and save to database."""
    # Clear existing categories and tags for this site
    stmt = select(Category).where(Category.site_id == site_id)
    result = await db.execute(stmt)
    for category in result.scalars().all():
        await db.delete(category)
        
    stmt = select(Tag).where(Tag.site_id == site_id)
    result = await db.execute(stmt)
    for tag in result.scalars().all():
        await db.delete(tag)
    
    # Fetch categories
    categories = await wp_service.get_categories()
    for category in categories:
        db_category = Category(
            site_id=site_id,
            wp_id=category["id"],
            name=category["name"]
        )
        db.add(db_category)
    
    # Fetch tags
    tags = await wp_service.get_tags()
    for tag in tags:
        db_tag = Tag(
            site_id=site_id,
            wp_id=tag["id"],
            name=tag["name"]
        )
        db.add(db_tag)
    
    await db.commit()

@router.post("/test-connection", response_model=ConnectionTestResponse)
async def test_connection(
    connection_data: ConnectionTestRequest
):
    """Test connection to a WordPress site without saving."""
    wp_service = WordPressService(
        api_url=str(connection_data.api_url),
        username=connection_data.username,
        app_password=connection_data.app_password
    )
    
    result = await wp_service.verify_connection()
    
    if result["success"]:
        return {
            "success": True,
            "message": "Successfully connected to WordPress site",
            "user_info": result["data"]
        }
    else:
        return {
            "success": False,
            "message": f"Failed to connect: {result.get('error', 'Unknown error')}",
            "user_info": None
        }

@router.post("/", response_model=WordPressSiteResponse)
async def create_wordpress_site(
    site_data: WordPressSiteCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new WordPress site connection."""
    # Test the connection first
    wp_service = WordPressService(
        api_url=str(site_data.api_url),
        username=site_data.username,
        app_password=site_data.app_password
    )
    
    connection_test = await wp_service.verify_connection()
    if not connection_test["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to WordPress site: {connection_test.get('error', 'Unknown error')}"
        )
    
    # Create site in database
    new_site = WordPressSite(
        user_id=current_user.id,
        name=site_data.name,
        url=str(site_data.url),
        api_url=str(site_data.api_url),
        username=site_data.username,
        app_password=site_data.app_password
    )
    
    db.add(new_site)
    await db.commit()
    await db.refresh(new_site)
    
    # Fetch categories and tags in the background
    background_tasks.add_task(
        fetch_and_save_taxonomies, db, new_site.id, wp_service
    )
    
    return new_site

@router.get("/", response_model=List[WordPressSiteResponse])
async def get_wordpress_sites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all WordPress sites for the current user."""
    stmt = select(WordPressSite).where(WordPressSite.user_id == current_user.id)
    result = await db.execute(stmt)
    sites = result.scalars().all()
    return sites

@router.get("/{site_id}", response_model=WordPressSiteDetail)
async def get_wordpress_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific WordPress site with categories and tags."""
    stmt = select(WordPressSite).where(
        (WordPressSite.id == site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Get categories
    stmt = select(Category).where(Category.site_id == site_id)
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    # Get tags
    stmt = select(Tag).where(Tag.site_id == site_id)
    result = await db.execute(stmt)
    tags = result.scalars().all()
    
    return {
        **site.__dict__,
        "categories": categories,
        "tags": tags
    }

@router.get("/{site_id}/categories", response_model=List[CategoryResponse])
async def get_categories(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all categories for a WordPress site."""
    # Check site exists and belongs to user
    stmt = select(WordPressSite).where(
        (WordPressSite.id == site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Get categories
    stmt = select(Category).where(Category.site_id == site_id)
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    return categories

@router.get("/{site_id}/tags", response_model=List[TagResponse])
async def get_tags(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all tags for a WordPress site."""
    # Check site exists and belongs to user
    stmt = select(WordPressSite).where(
        (WordPressSite.id == site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Get tags
    stmt = select(Tag).where(Tag.site_id == site_id)
    result = await db.execute(stmt)
    tags = result.scalars().all()
    
    return tags

@router.post("/{site_id}/refresh", response_model=WordPressSiteDetail)
async def refresh_taxonomies(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Refresh categories and tags for a WordPress site."""
    # Check site exists and belongs to user
    stmt = select(WordPressSite).where(
        (WordPressSite.id == site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Initialize WordPress service
    wp_service = WordPressService(
        api_url=site.api_url,
        username=site.username,
        app_password=site.app_password
    )
    
    # Test connection
    connection_test = await wp_service.verify_connection()
    if not connection_test["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to WordPress site: {connection_test.get('error', 'Unknown error')}"
        )
    
    # Fetch and save taxonomies
    await fetch_and_save_taxonomies(db, site_id, wp_service)
    
    # Get updated categories
    stmt = select(Category).where(Category.site_id == site_id)
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    # Get updated tags
    stmt = select(Tag).where(Tag.site_id == site_id)
    result = await db.execute(stmt)
    tags = result.scalars().all()
    
    return {
        **site.__dict__,
        "categories": categories,
        "tags": tags
    }

@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wordpress_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a WordPress site."""
    stmt = select(WordPressSite).where(
        (WordPressSite.id == site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    site = result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    await db.delete(site)
    await db.commit() 