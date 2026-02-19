import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.site import Site
from app.models.user import User
from app.schemas.shopify import (
    ShopifyBlogOption,
    ShopifyBlogsResponse,
    ShopifyInstallUrlRequest,
    ShopifyInstallUrlResponse,
)
from app.services import shopify_oauth
from app.services.shopify_connections import (
    ShopifyConnectionError,
    resolve_site_access_token,
    upsert_site_connection,
)

router = APIRouter(prefix="/shopify", tags=["shopify"])


def _frontend_callback_redirect(
    *,
    site_id: str | None,
    success: bool,
    message: str | None = None,
) -> RedirectResponse:
    base = f"/sites/{site_id}/edit" if site_id else "/sites"
    params = {"shopify_connected": "1"} if success else {"shopify_error": message or "Shopify connect failed"}
    location = (
        f"{settings.FRONTEND_URL.rstrip('/')}{base}"
        f"?{urlencode(params)}"
    )
    return RedirectResponse(url=location, status_code=302)


@router.post("/install-url", response_model=ShopifyInstallUrlResponse)
async def get_install_url(
    data: ShopifyInstallUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        shopify_oauth.ensure_shopify_oauth_configured()
    except shopify_oauth.ShopifyOAuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    result = await db.execute(
        select(Site).where(
            Site.id == data.site_id,
            Site.user_id == current_user.id,
            Site.platform == "shopify",
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Shopify site not found")

    try:
        shop_domain = shopify_oauth.normalize_shop_domain(data.shop_domain or site.url)
    except shopify_oauth.ShopifyOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    state_token, expires_at = shopify_oauth.create_state_token(
        user_id=str(current_user.id),
        site_id=str(site.id),
        shop_domain=shop_domain,
    )
    auth_url = shopify_oauth.build_install_url(shop_domain, state_token)
    return ShopifyInstallUrlResponse(
        auth_url=auth_url,
        shop_domain=shop_domain,
        expires_at=expires_at,
    )


@router.get("/sites/{site_id}/blogs", response_model=ShopifyBlogsResponse)
async def get_site_blogs(
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        site_uuid = uuid.UUID(site_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid site id")

    result = await db.execute(
        select(Site).where(
            Site.id == site_uuid,
            Site.user_id == current_user.id,
            Site.platform == "shopify",
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(status_code=404, detail="Shopify site not found")

    try:
        access_token = await resolve_site_access_token(db, site=site)
    except ShopifyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if not access_token:
        return ShopifyBlogsResponse(connected=False, blogs=[])

    try:
        blogs = await shopify_oauth.fetch_blogs(site.api_url, access_token)
    except shopify_oauth.ShopifyOAuthError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return ShopifyBlogsResponse(
        connected=True,
        blogs=[ShopifyBlogOption(id=b["id"], title=b["title"]) for b in blogs],
    )


@router.get("/callback")
async def oauth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        shopify_oauth.ensure_shopify_oauth_configured()
    except shopify_oauth.ShopifyOAuthError as exc:
        return _frontend_callback_redirect(site_id=None, success=False, message=str(exc))

    query = dict(request.query_params)
    state_token = query.get("state")
    code = query.get("code")
    shop = query.get("shop")
    if not state_token or not code or not shop:
        return _frontend_callback_redirect(
            site_id=None,
            success=False,
            message="Missing Shopify OAuth callback parameters",
        )

    if not shopify_oauth.verify_callback_hmac(request.url.query):
        return _frontend_callback_redirect(
            site_id=None,
            success=False,
            message="Invalid Shopify callback signature",
        )

    try:
        state_payload = shopify_oauth.decode_state_token(state_token)
        state_shop = shopify_oauth.normalize_shop_domain(state_payload["shop"])
        callback_shop = shopify_oauth.normalize_shop_domain(shop)
        if callback_shop != state_shop:
            raise shopify_oauth.ShopifyOAuthError("Shop domain mismatch during OAuth callback")

        user_id = uuid.UUID(state_payload["uid"])
        site_id = uuid.UUID(state_payload["sid"])
    except (ValueError, shopify_oauth.ShopifyOAuthError) as exc:
        return _frontend_callback_redirect(site_id=None, success=False, message=str(exc))

    result = await db.execute(
        select(Site).where(
            Site.id == site_id,
            Site.user_id == user_id,
            Site.platform == "shopify",
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        return _frontend_callback_redirect(
            site_id=None,
            success=False,
            message="Shopify site not found for OAuth callback",
        )

    try:
        token_data = await shopify_oauth.exchange_access_token(callback_shop, code)
    except shopify_oauth.ShopifyOAuthError as exc:
        return _frontend_callback_redirect(site_id=str(site.id), success=False, message=str(exc))

    try:
        await upsert_site_connection(
            db,
            site=site,
            shop_domain=callback_shop,
            access_token=token_data["access_token"],
            scopes=token_data.get("scope"),
        )
    except ShopifyConnectionError as exc:
        return _frontend_callback_redirect(site_id=str(site.id), success=False, message=str(exc))

    site.url = f"https://{callback_shop}"
    site.api_url = shopify_oauth.build_admin_api_url(callback_shop)
    site.api_key = None  # keep OAuth token out of the legacy plaintext field
    site.last_health_check = datetime.now(timezone.utc)

    try:
        blogs = await shopify_oauth.fetch_blogs(site.api_url, token_data["access_token"])
        if blogs and not site.default_blog_id:
            site.default_blog_id = blogs[0]["id"]
    except shopify_oauth.ShopifyOAuthError:
        # Blog fetch is non-blocking for OAuth completion.
        pass

    await db.commit()
    return _frontend_callback_redirect(site_id=str(site.id), success=True)
