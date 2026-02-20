from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import EncryptionError, decrypt_secret, encrypt_secret
from app.models.shopify_connection import ShopifyConnection
from app.models.site import Site
from app.services import shopify_oauth


class ShopifyConnectionError(Exception):
    """Raised when stored Shopify connection credentials cannot be used."""


def _normalize_domain_or_fallback(raw_value: str | None) -> str | None:
    """Normalize a domain using Shopify rules, with tolerant fallback."""
    if not raw_value:
        return None

    candidate = raw_value.strip()
    if not candidate:
        return None

    try:
        return shopify_oauth.normalize_shop_domain(candidate)
    except shopify_oauth.ShopifyOAuthError:
        return candidate.lower()


async def upsert_site_connection(
    db: AsyncSession,
    *,
    site: Site,
    shop_domain: str,
    access_token: str,
    scopes: str | None = None,
) -> ShopifyConnection:
    """Insert or update encrypted Shopify credentials for a site."""
    try:
        encrypted_token = encrypt_secret(access_token)
    except EncryptionError as exc:
        raise ShopifyConnectionError(str(exc)) from exc

    existing_result = await db.execute(
        select(ShopifyConnection).where(ShopifyConnection.site_id == site.id)
    )
    connection = existing_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    normalized_domain = (shop_domain or "").strip().lower()

    if connection:
        connection.user_id = site.user_id
        connection.shop_domain = normalized_domain or connection.shop_domain
        connection.access_token_encrypted = encrypted_token
        connection.scopes = scopes
        connection.is_active = True
        connection.last_connected_at = now
        connection.disconnected_at = None
        return connection

    connection = ShopifyConnection(
        user_id=site.user_id,
        site_id=site.id,
        shop_domain=normalized_domain or site.url,
        access_token_encrypted=encrypted_token,
        scopes=scopes,
        is_active=True,
        installed_at=now,
        last_connected_at=now,
    )
    db.add(connection)
    return connection


async def get_active_site_connection(
    db: AsyncSession,
    *,
    site_id,
    user_id,
) -> ShopifyConnection | None:
    result = await db.execute(
        select(ShopifyConnection).where(
            ShopifyConnection.site_id == site_id,
            ShopifyConnection.user_id == user_id,
            ShopifyConnection.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def resolve_site_access_token(
    db: AsyncSession,
    *,
    site: Site,
) -> str | None:
    """Resolve a Shopify access token from legacy site.api_key or encrypted connection."""
    if site.api_key:
        return site.api_key

    connection = await get_active_site_connection(
        db,
        site_id=site.id,
        user_id=site.user_id,
    )
    if not connection:
        return None

    try:
        return decrypt_secret(connection.access_token_encrypted)
    except EncryptionError as exc:
        raise ShopifyConnectionError(str(exc)) from exc


async def disconnect_shop_connections(
    db: AsyncSession,
    *,
    shop_domain: str,
) -> dict[str, int]:
    """Deactivate matching Shopify connections and clear legacy site tokens."""
    normalized_target = _normalize_domain_or_fallback(shop_domain)
    if not normalized_target:
        raise ShopifyConnectionError("Shop domain is required")

    now = datetime.now(timezone.utc)
    disconnected_connections = 0
    matched_connections = 0
    matched_site_ids = set()

    connections_result = await db.execute(select(ShopifyConnection))
    for connection in connections_result.scalars().all():
        connection_domain = _normalize_domain_or_fallback(connection.shop_domain)
        if connection_domain != normalized_target:
            continue

        matched_connections += 1
        matched_site_ids.add(connection.site_id)
        if connection.is_active:
            disconnected_connections += 1
            connection.disconnected_at = now
        elif connection.disconnected_at is None:
            connection.disconnected_at = now
        connection.is_active = False

    matched_sites = 0
    cleared_site_tokens = 0
    sites_result = await db.execute(select(Site).where(Site.platform == "shopify"))
    for site in sites_result.scalars().all():
        site_domain = _normalize_domain_or_fallback(site.url)
        if site_domain != normalized_target and site.id not in matched_site_ids:
            continue

        matched_sites += 1
        if site.api_key:
            cleared_site_tokens += 1
        site.api_key = None

    return {
        "matched_connections": matched_connections,
        "disconnected_connections": disconnected_connections,
        "matched_sites": matched_sites,
        "cleared_site_tokens": cleared_site_tokens,
    }
