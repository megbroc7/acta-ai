import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_refresh_token
from app.models.refresh_token import RefreshToken


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _refresh_expiry() -> datetime:
    return _utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


async def create_refresh_token_session(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    family_id: uuid.UUID | None = None,
    parent_token_jti: uuid.UUID | None = None,
) -> tuple[str, RefreshToken]:
    token_jti = uuid.uuid4()
    token_family = family_id or token_jti
    expires_at = _refresh_expiry()
    refresh_token = create_refresh_token(
        str(user_id),
        token_jti=str(token_jti),
        token_family=str(token_family),
    )

    token_row = RefreshToken(
        user_id=user_id,
        token_jti=token_jti,
        token_family=token_family,
        parent_token_jti=parent_token_jti,
        expires_at=expires_at,
    )
    db.add(token_row)
    return refresh_token, token_row


async def get_refresh_token_session(
    db: AsyncSession,
    *,
    token_jti: uuid.UUID,
) -> RefreshToken | None:
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_jti == token_jti))
    return result.scalar_one_or_none()


def mark_token_rotated(
    *,
    token_row: RefreshToken,
    replaced_by_jti: uuid.UUID,
) -> None:
    now = _utcnow()
    token_row.revoked_at = now
    token_row.revocation_reason = "rotated"
    token_row.replaced_by_jti = replaced_by_jti
    token_row.updated_at = now


async def revoke_refresh_token_family(
    db: AsyncSession,
    *,
    token_family: uuid.UUID,
    reason: str,
) -> None:
    now = _utcnow()
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_family == token_family,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now, revocation_reason=reason, updated_at=now)
    )
