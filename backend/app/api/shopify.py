import json
import logging
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
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
    disconnect_shop_connections,
    resolve_site_access_token,
    upsert_site_connection,
)

router = APIRouter(prefix="/shopify", tags=["shopify"])
logger = logging.getLogger(__name__)


def _site_id_from_state_token(state_token: str | None) -> str | None:
    """Best-effort state decode used only for frontend error redirect targeting."""
    if not state_token:
        return None
    try:
        state_payload = shopify_oauth.decode_state_token(state_token)
        return str(uuid.UUID(state_payload["sid"]))
    except (KeyError, ValueError, shopify_oauth.ShopifyOAuthError):
        # If state is expired, decode unverified claims so we can still land the
        # user on the correct site edit page with a useful error message.
        try:
            state_payload = jwt.get_unverified_claims(state_token)
            return str(uuid.UUID(state_payload["sid"]))
        except (JWTError, KeyError, ValueError):
            return None


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


async def _parse_verified_webhook(
    request: Request,
    *,
    expected_topics: set[str],
) -> tuple[str, str, dict]:
    """Validate Shopify webhook headers/signature and parse the JSON payload."""
    try:
        shopify_oauth.ensure_shopify_oauth_configured()
    except shopify_oauth.ShopifyOAuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    raw_body = await request.body()
    provided_hmac = request.headers.get("x-shopify-hmac-sha256", "")
    if not shopify_oauth.verify_webhook_hmac(raw_body, provided_hmac):
        raise HTTPException(status_code=401, detail="Invalid Shopify webhook signature")

    topic = request.headers.get("x-shopify-topic", "").strip()
    if topic not in expected_topics:
        raise HTTPException(
            status_code=400,
            detail=f"Unexpected Shopify webhook topic: {topic or 'missing'}",
        )

    raw_shop_domain = request.headers.get("x-shopify-shop-domain", "").strip()
    if not raw_shop_domain:
        raise HTTPException(status_code=400, detail="Missing Shopify shop domain header")

    try:
        shop_domain = shopify_oauth.normalize_shop_domain(raw_shop_domain)
    except shopify_oauth.ShopifyOAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not raw_body:
        return shop_domain, request.headers.get("x-shopify-webhook-id", "").strip(), {}

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid Shopify webhook payload")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid Shopify webhook payload")

    webhook_id = request.headers.get("x-shopify-webhook-id", "").strip()
    return shop_domain, webhook_id, payload


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
    state_site_id = _site_id_from_state_token(state_token)
    code = query.get("code")
    shop = query.get("shop")
    if not state_token or not code or not shop:
        return _frontend_callback_redirect(
            site_id=state_site_id,
            success=False,
            message="Missing Shopify OAuth callback parameters",
        )

    if not shopify_oauth.verify_callback_hmac(request.url.query):
        return _frontend_callback_redirect(
            site_id=state_site_id,
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
        return _frontend_callback_redirect(
            site_id=state_site_id,
            success=False,
            message=str(exc),
        )

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
        shopify_oauth.validate_granted_scopes(token_data.get("scope"))
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


@router.post("/webhooks/customers/data_request")
async def customers_data_request_webhook(request: Request):
    shop_domain, webhook_id, payload = await _parse_verified_webhook(
        request,
        expected_topics={"customers/data_request"},
    )
    logger.info(
        "Processed Shopify webhook topic=customers/data_request shop=%s webhook_id=%s has_payload=%s",
        shop_domain,
        webhook_id or "n/a",
        bool(payload),
    )
    return {"status": "ok"}


@router.post("/webhooks/customers/redact")
async def customers_redact_webhook(request: Request):
    shop_domain, webhook_id, payload = await _parse_verified_webhook(
        request,
        expected_topics={"customers/redact"},
    )
    logger.info(
        "Processed Shopify webhook topic=customers/redact shop=%s webhook_id=%s has_payload=%s",
        shop_domain,
        webhook_id or "n/a",
        bool(payload),
    )
    return {"status": "ok"}


@router.post("/webhooks/shop/redact")
async def shop_redact_webhook(request: Request):
    shop_domain, webhook_id, payload = await _parse_verified_webhook(
        request,
        expected_topics={"shop/redact"},
    )
    logger.info(
        "Processed Shopify webhook topic=shop/redact shop=%s webhook_id=%s has_payload=%s",
        shop_domain,
        webhook_id or "n/a",
        bool(payload),
    )
    return {"status": "ok"}


@router.post("/webhooks/app/uninstalled")
async def app_uninstalled_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    shop_domain, webhook_id, payload = await _parse_verified_webhook(
        request,
        expected_topics={"app/uninstalled"},
    )

    try:
        summary = await disconnect_shop_connections(db, shop_domain=shop_domain)
    except ShopifyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    await db.commit()
    logger.info(
        "Processed Shopify webhook topic=app/uninstalled shop=%s webhook_id=%s payload_keys=%s matched_connections=%d disconnected_connections=%d matched_sites=%d cleared_site_tokens=%d",
        shop_domain,
        webhook_id or "n/a",
        ",".join(sorted(payload.keys())) if payload else "none",
        summary["matched_connections"],
        summary["disconnected_connections"],
        summary["matched_sites"],
        summary["cleared_site_tokens"],
    )
    return {"status": "ok"}


@router.post("/webhooks/compliance")
async def compliance_webhook(request: Request):
    compliance_topics = {
        "customers/data_request",
        "customers/redact",
        "shop/redact",
    }
    shop_domain, webhook_id, payload = await _parse_verified_webhook(
        request,
        expected_topics=compliance_topics,
    )
    topic = request.headers.get("x-shopify-topic", "").strip()
    logger.info(
        "Processed Shopify compliance webhook topic=%s shop=%s webhook_id=%s has_payload=%s",
        topic,
        shop_domain,
        webhook_id or "n/a",
        bool(payload),
    )
    return {"status": "ok"}
