import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.site import Category, Tag, Site
from app.models.user import User
from app.schemas.sites import (
    BlogOption,
    CategoryResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    Platform,
    SiteCreate,
    SiteDetail,
    SiteResponse,
    SiteUpdate,
    TagResponse,
)

router = APIRouter(prefix="/sites", tags=["sites"])


async def _test_wp_connection(api_url: str, username: str, app_password: str) -> dict:
    import base64

    api_url = api_url.rstrip("/")
    credentials = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    headers = {"Authorization": f"Basic {credentials}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{api_url}/wp/v2/users/me", headers=headers)
        if resp.status_code == 200:
            return {"success": True, "data": resp.json()}
        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


async def _fetch_categories(api_url: str, username: str, app_password: str) -> list[dict]:
    import base64

    api_url = api_url.rstrip("/")
    credentials = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    headers = {"Authorization": f"Basic {credentials}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{api_url}/wp/v2/categories?per_page=100", headers=headers)
        return resp.json() if resp.status_code == 200 else []


async def _fetch_tags(api_url: str, username: str, app_password: str) -> list[dict]:
    import base64

    api_url = api_url.rstrip("/")
    credentials = base64.b64encode(f"{username}:{app_password}".encode()).decode()
    headers = {"Authorization": f"Basic {credentials}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{api_url}/wp/v2/tags?per_page=100", headers=headers)
        return resp.json() if resp.status_code == 200 else []


async def _test_shopify_connection(api_url: str, api_key: str) -> dict:
    headers = {"X-Shopify-Access-Token": api_key}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{api_url}/shop.json", headers=headers)
        if resp.status_code == 200:
            return {"success": True, "data": resp.json()}
        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


async def _fetch_shopify_blogs(api_url: str, api_key: str) -> list[dict]:
    headers = {"X-Shopify-Access-Token": api_key}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{api_url}/blogs.json", headers=headers)
        if resp.status_code == 200:
            return [
                {"id": str(b["id"]), "title": b["title"]}
                for b in resp.json().get("blogs", [])
            ]
        return []


@router.post("/test-connection", response_model=ConnectionTestResponse)
async def test_connection(
    data: ConnectionTestRequest,
    current_user: User = Depends(get_current_user),
):
    if data.platform == Platform.wordpress:
        try:
            result = await _test_wp_connection(data.api_url, data.username, data.app_password)
            if result["success"]:
                return ConnectionTestResponse(success=True, message="Connection successful")
            return ConnectionTestResponse(success=False, message=result["error"])
        except httpx.ConnectError:
            return ConnectionTestResponse(success=False, message="Could not connect to the site")
        except httpx.TimeoutException:
            return ConnectionTestResponse(success=False, message="Connection timed out")
        except Exception as e:
            return ConnectionTestResponse(success=False, message=str(e))
    elif data.platform == Platform.shopify:
        try:
            result = await _test_shopify_connection(data.api_url, data.api_key)
            if result["success"]:
                shop_name = result["data"].get("shop", {}).get("name", "Shopify store")
                blogs = await _fetch_shopify_blogs(data.api_url, data.api_key)
                blog_options = [BlogOption(id=b["id"], title=b["title"]) for b in blogs]
                return ConnectionTestResponse(
                    success=True,
                    message=f"Connected to {shop_name}",
                    blogs=blog_options,
                )
            return ConnectionTestResponse(success=False, message=result["error"])
        except httpx.ConnectError:
            return ConnectionTestResponse(success=False, message="Could not connect to the store")
        except httpx.TimeoutException:
            return ConnectionTestResponse(success=False, message="Connection timed out")
        except Exception as e:
            return ConnectionTestResponse(success=False, message=str(e))
    elif data.platform == Platform.wix:
        return ConnectionTestResponse(success=False, message="Wix connection testing coming soon")


@router.post("/", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    data: SiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    site = Site(
        user_id=current_user.id,
        name=data.name,
        url=data.url,
        api_url=data.api_url,
        platform=data.platform,
        username=data.username,
        app_password=data.app_password,
        api_key=data.api_key,
        default_blog_id=data.default_blog_id,
    )
    db.add(site)
    await db.commit()
    await db.refresh(site)

    # Fetch categories and tags for WordPress sites
    if data.platform == Platform.wordpress:
        try:
            cats = await _fetch_categories(data.api_url, data.username, data.app_password)
            for c in cats:
                db.add(Category(site_id=site.id, platform_id=str(c["id"]), name=c["name"]))

            tags = await _fetch_tags(data.api_url, data.username, data.app_password)
            for t in tags:
                db.add(Tag(site_id=site.id, platform_id=str(t["id"]), name=t["name"]))

            await db.commit()
        except Exception:
            pass  # Non-critical — categories/tags can be fetched later

    return site


@router.get("/", response_model=list[SiteResponse])
async def list_sites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Site).where(Site.user_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/{site_id}", response_model=SiteDetail)
async def get_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Site)
        .where(Site.id == site_id, Site.user_id == current_user.id)
        .options(selectinload(Site.categories), selectinload(Site.tags))
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.put("/{site_id}", response_model=SiteResponse)
async def update_site(
    site_id: str,
    data: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Site).where(
            Site.id == site_id, Site.user_id == current_user.id
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(site, key, value)

    await db.commit()
    await db.refresh(site)
    return site


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Site).where(
            Site.id == site_id, Site.user_id == current_user.id
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    await db.delete(site)
    await db.commit()


@router.get("/{site_id}/categories", response_model=list[CategoryResponse])
async def get_categories(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify site ownership
    result = await db.execute(
        select(Site).where(
            Site.id == site_id, Site.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Site not found")

    result = await db.execute(select(Category).where(Category.site_id == site_id))
    return result.scalars().all()


@router.get("/{site_id}/tags", response_model=list[TagResponse])
async def get_tags(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Site).where(
            Site.id == site_id, Site.user_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Site not found")

    result = await db.execute(select(Tag).where(Tag.site_id == site_id))
    return result.scalars().all()


@router.post("/{site_id}/refresh", response_model=SiteDetail)
async def refresh_site(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Site)
        .where(Site.id == site_id, Site.user_id == current_user.id)
        .options(selectinload(Site.categories), selectinload(Site.tags))
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    from datetime import datetime, timezone as tz

    if site.platform == "wordpress":
        # Clear existing
        for cat in site.categories:
            await db.delete(cat)
        for tag in site.tags:
            await db.delete(tag)

        # Re-fetch
        cats = await _fetch_categories(site.api_url, site.username, site.app_password)
        for c in cats:
            db.add(Category(site_id=site.id, platform_id=str(c["id"]), name=c["name"]))

        tags = await _fetch_tags(site.api_url, site.username, site.app_password)
        for t in tags:
            db.add(Tag(site_id=site.id, platform_id=str(t["id"]), name=t["name"]))
    elif site.platform == "shopify":
        # Shopify has no categories/tags to sync — just verify connection
        result = await _test_shopify_connection(site.api_url, site.api_key)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=f"Shopify connection failed: {result['error']}")
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Refresh is not yet supported for {site.platform.title()} sites",
        )

    site.last_health_check = datetime.now(tz.utc)
    await db.commit()

    # Re-query with relationships
    result = await db.execute(
        select(Site)
        .where(Site.id == site_id)
        .options(selectinload(Site.categories), selectinload(Site.tags))
    )
    return result.scalar_one()
