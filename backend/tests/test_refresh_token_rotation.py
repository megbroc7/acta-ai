import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from jose import jwt
from starlette.requests import Request

from app.api.auth import login, refresh_token
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import ALGORITHM, create_refresh_token, decode_token, hash_password
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import RefreshRequest


class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDB:
    def __init__(self, results=None):
        self._results = deque(results or [])
        self.added = []
        self.commits = 0
        self.executed = 0

    async def execute(self, *_args, **_kwargs):
        self.executed += 1
        value = self._results.popleft() if self._results else None
        return _FakeScalarResult(value)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1


def _request_with_client(host: str) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/refresh",
        "headers": [],
        "scheme": "http",
        "client": (host, 50000),
        "server": ("testserver", 80),
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    limiter.clear()


@pytest.mark.asyncio
async def test_login_creates_refresh_session_with_jti_and_family():
    user = User(
        id=uuid.uuid4(),
        email="user@example.com",
        hashed_password=hash_password("secret123"),
        full_name="User",
        is_active=True,
    )
    form_data = SimpleNamespace(username=user.email, password="secret123")
    db = _FakeDB(results=[user])

    response = await login(
        request=_request_with_client("198.51.100.10"),
        form_data=form_data,
        db=db,
    )

    assert db.commits == 1
    assert len(db.added) == 1
    assert isinstance(db.added[0], RefreshToken)

    payload = decode_token(response.refresh_token)
    assert payload is not None
    assert payload.get("jti")
    assert payload.get("family")
    assert payload.get("jti") == str(db.added[0].token_jti)
    assert payload.get("family") == str(db.added[0].token_family)


@pytest.mark.asyncio
async def test_refresh_rotates_token_and_revokes_previous_session():
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="rotate@example.com",
        hashed_password=hash_password("secret123"),
        full_name="Rotate User",
        is_active=True,
    )
    old_jti = uuid.uuid4()
    family = uuid.uuid4()
    old_token = create_refresh_token(
        str(user_id),
        token_jti=str(old_jti),
        token_family=str(family),
    )
    old_row = RefreshToken(
        user_id=user_id,
        token_jti=old_jti,
        token_family=family,
        parent_token_jti=None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db = _FakeDB(results=[old_row, user])

    response = await refresh_token(
        request=_request_with_client("198.51.100.11"),
        data=RefreshRequest(refresh_token=old_token),
        db=db,
    )

    assert db.commits == 1
    assert old_row.revoked_at is not None
    assert old_row.revocation_reason == "rotated"
    assert old_row.replaced_by_jti is not None

    assert len(db.added) == 1
    new_row = db.added[0]
    assert isinstance(new_row, RefreshToken)
    assert new_row.token_family == family
    assert new_row.parent_token_jti == old_jti

    payload = decode_token(response.refresh_token)
    assert payload is not None
    assert payload.get("family") == str(family)
    assert payload.get("jti") == str(new_row.token_jti)
    assert response.refresh_token != old_token


@pytest.mark.asyncio
async def test_refresh_rejects_legacy_token_without_jti_claims():
    user_id = uuid.uuid4()
    legacy_token = jwt.encode(
        {
            "sub": str(user_id),
            "exp": datetime.now(timezone.utc) + timedelta(days=1),
            "type": "refresh",
        },
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    db = _FakeDB()

    with pytest.raises(HTTPException, match="Invalid refresh token"):
        await refresh_token(
            request=_request_with_client("198.51.100.12"),
            data=RefreshRequest(refresh_token=legacy_token),
            db=db,
        )
    assert db.commits == 0


@pytest.mark.asyncio
async def test_refresh_reuse_detection_revokes_family_and_fails():
    user_id = uuid.uuid4()
    old_jti = uuid.uuid4()
    family = uuid.uuid4()
    reused_token = create_refresh_token(
        str(user_id),
        token_jti=str(old_jti),
        token_family=str(family),
    )
    reused_row = RefreshToken(
        user_id=user_id,
        token_jti=old_jti,
        token_family=family,
        parent_token_jti=None,
        replaced_by_jti=uuid.uuid4(),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        revoked_at=datetime.now(timezone.utc),
        revocation_reason="rotated",
    )
    # First execute resolves the row, second execute is family revoke UPDATE.
    db = _FakeDB(results=[reused_row, None])

    with pytest.raises(HTTPException, match="Refresh token reuse detected"):
        await refresh_token(
            request=_request_with_client("198.51.100.13"),
            data=RefreshRequest(refresh_token=reused_token),
            db=db,
        )

    assert db.commits == 1
