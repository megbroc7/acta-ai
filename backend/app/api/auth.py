import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import RefreshRequest, TokenResponse, UserCreate, UserResponse
from app.api.deps import get_current_user
from app.services.refresh_tokens import (
    create_refresh_token_session,
    get_refresh_token_session,
    mark_token_rotated,
    revoke_refresh_token_family,
)

TRIAL_DAYS = 14

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_claim_as_uuid(payload: dict, claim_name: str) -> uuid.UUID:
    value = payload.get(claim_name)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    enforce_rate_limit(
        request,
        bucket="auth_register",
        limit=settings.RATE_LIMIT_AUTH_REGISTER,
    )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/token", response_model=TokenResponse)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    enforce_rate_limit(
        request,
        bucket="auth_token",
        limit=settings.RATE_LIMIT_AUTH_TOKEN,
    )

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    refresh_token, _token_row = await create_refresh_token_session(db, user_id=user.id)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    data: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    enforce_rate_limit(
        request,
        bucket="auth_refresh",
        limit=settings.RATE_LIMIT_AUTH_REFRESH,
    )

    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id_claim = payload.get("sub")
    if not user_id_claim:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    try:
        user_uuid = uuid.UUID(str(user_id_claim))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    token_jti = _token_claim_as_uuid(payload, "jti")
    token_family = _token_claim_as_uuid(payload, "family")
    token_row = await get_refresh_token_session(db, token_jti=token_jti)
    if not token_row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    if token_row.user_id != user_uuid or token_row.token_family != token_family:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    now = datetime.now(timezone.utc)
    if token_row.expires_at <= now:
        if token_row.revoked_at is None:
            token_row.revoked_at = now
            token_row.revocation_reason = "expired"
            token_row.updated_at = now
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if token_row.revoked_at is not None:
        if token_row.replaced_by_jti is not None:
            await revoke_refresh_token_family(
                db,
                token_family=token_row.token_family,
                reason="reuse_detected",
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token reuse detected. Please sign in again.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        await revoke_refresh_token_family(
            db,
            token_family=token_row.token_family,
            reason="user_inactive",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    new_refresh_token, new_token_row = await create_refresh_token_session(
        db,
        user_id=user.id,
        family_id=token_row.token_family,
        parent_token_jti=token_row.token_jti,
    )
    mark_token_rotated(token_row=token_row, replaced_by_jti=new_token_row.token_jti)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=new_refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
