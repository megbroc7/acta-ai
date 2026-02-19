from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import EncryptionError, decrypt_secret, encrypt_secret
from app.models.shopify_connection import ShopifyConnection
from app.models.site import Site


class ShopifyConnectionError(Exception):
    """Raised when stored Shopify connection credentials cannot be used."""


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
