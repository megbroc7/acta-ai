import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlparse

import httpx
from jose import JWTError, jwt

from app.core.config import settings

STATE_ALGORITHM = "HS256"
STATE_TTL_MINUTES = 10


class ShopifyOAuthError(Exception):
    """Raised when Shopify OAuth setup or exchange fails."""


def ensure_shopify_oauth_configured() -> None:
    """Ensure required Shopify OAuth settings are configured."""
    missing = []
    if not settings.SHOPIFY_APP_CLIENT_ID:
        missing.append("SHOPIFY_APP_CLIENT_ID")
    if not settings.SHOPIFY_APP_CLIENT_SECRET:
        missing.append("SHOPIFY_APP_CLIENT_SECRET")
    if missing:
        raise ShopifyOAuthError(
            f"Missing Shopify OAuth config: {', '.join(missing)}"
        )


def normalize_shop_domain(raw_value: str) -> str:
    """Normalize and validate a Shopify myshopify domain."""
    if not raw_value or not raw_value.strip():
        raise ShopifyOAuthError("Shop domain is required")

    candidate = raw_value.strip().lower()
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    parsed = urlparse(candidate)
    domain = parsed.netloc or parsed.path
    domain = domain.split("/")[0].split(":")[0].strip()
    if domain.startswith("www."):
        domain = domain[4:]

    # Public app OAuth should always use the canonical *.myshopify.com domain.
    if not re.match(r"^[a-z0-9][a-z0-9-]*\.myshopify\.com$", domain):
        raise ShopifyOAuthError(
            "Use your myshopify domain (example: your-store.myshopify.com)"
        )
    return domain


def build_admin_api_url(shop_domain: str) -> str:
    return f"https://{shop_domain}/admin/api/{settings.SHOPIFY_API_VERSION}"


def build_oauth_redirect_uri() -> str:
    return f"{settings.BACKEND_BASE_URL.rstrip('/')}{settings.API_V1_STR}/shopify/callback"


def create_state_token(user_id: str, site_id: str, shop_domain: str) -> tuple[str, datetime]:
    """Create a short-lived signed state token for callback verification."""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MINUTES)
    payload = {
        "type": "shopify_oauth_state",
        "uid": user_id,
        "sid": site_id,
        "shop": shop_domain,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=STATE_ALGORITHM)
    return token, expires_at


def decode_state_token(state_token: str) -> dict:
    try:
        payload = jwt.decode(
            state_token,
            settings.SECRET_KEY,
            algorithms=[STATE_ALGORITHM],
        )
    except JWTError as exc:
        raise ShopifyOAuthError("OAuth state is invalid or expired") from exc

    if payload.get("type") != "shopify_oauth_state":
        raise ShopifyOAuthError("OAuth state token type is invalid")
    for key in ("uid", "sid", "shop"):
        if not payload.get(key):
            raise ShopifyOAuthError("OAuth state payload is incomplete")
    return payload


def build_install_url(shop_domain: str, state_token: str) -> str:
    scopes = ",".join(
        part.strip() for part in settings.SHOPIFY_SCOPES.split(",") if part.strip()
    )
    params = {
        "client_id": settings.SHOPIFY_APP_CLIENT_ID,
        "scope": scopes,
        "redirect_uri": build_oauth_redirect_uri(),
        "state": state_token,
    }
    return f"https://{shop_domain}/admin/oauth/authorize?{urlencode(params)}"


def parse_scopes(raw_scopes: str | None) -> set[str]:
    """Split comma-delimited scopes into a normalized set."""
    if not raw_scopes:
        return set()
    return {part.strip() for part in raw_scopes.split(",") if part.strip()}


def required_scopes() -> set[str]:
    """Resolve required Shopify scopes from app settings."""
    return parse_scopes(settings.SHOPIFY_SCOPES)


def validate_granted_scopes(raw_scopes: str | None) -> None:
    """Ensure OAuth callback returned all required scopes."""
    required = required_scopes()
    granted = parse_scopes(raw_scopes)
    missing = sorted(required - granted)
    if missing:
        raise ShopifyOAuthError(
            f"Shopify connection is missing required scopes: {', '.join(missing)}"
        )


def verify_callback_hmac(raw_query: str) -> bool:
    """Verify Shopify callback HMAC signature."""
    pairs = parse_qsl(raw_query, keep_blank_values=True)
    data = dict(pairs)
    provided_hmac = data.get("hmac", "")
    if not provided_hmac:
        return False

    filtered = [(k, v) for (k, v) in pairs if k not in {"hmac", "signature"}]
    filtered.sort(key=lambda item: item[0])
    signed_items = [f"{key}={value}" for (key, value) in filtered]
    message = "&".join(signed_items)

    digest = hmac.new(
        settings.SHOPIFY_APP_CLIENT_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, provided_hmac)


async def exchange_access_token(shop_domain: str, code: str) -> dict:
    """Exchange Shopify OAuth code for an Admin API access token."""
    url = f"https://{shop_domain}/admin/oauth/access_token"
    payload = {
        "client_id": settings.SHOPIFY_APP_CLIENT_ID,
        "client_secret": settings.SHOPIFY_APP_CLIENT_SECRET,
        "code": code,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise ShopifyOAuthError(f"Failed to connect to Shopify: {exc}") from exc

    if response.status_code < 200 or response.status_code >= 300:
        detail = response.text[:300] if response.text else "No response body"
        raise ShopifyOAuthError(
            f"Shopify token exchange failed (HTTP {response.status_code}): {detail}"
        )

    data = response.json()
    if not data.get("access_token"):
        raise ShopifyOAuthError("Shopify token exchange returned no access token")
    return data


async def fetch_blogs(api_url: str, access_token: str) -> list[dict]:
    """Fetch Shopify blogs from the connected store."""
    headers = {"X-Shopify-Access-Token": access_token}
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{api_url.rstrip('/')}/blogs.json", headers=headers)
    if response.status_code == 200:
        return [
            {"id": str(blog["id"]), "title": blog["title"]}
            for blog in response.json().get("blogs", [])
        ]
    detail = response.text[:300] if response.text else "No response body"
    raise ShopifyOAuthError(
        f"Failed to fetch Shopify blogs (HTTP {response.status_code}): {detail}"
    )
