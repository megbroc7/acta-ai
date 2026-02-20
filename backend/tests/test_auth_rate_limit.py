from starlette.requests import Request

from app.core.config import settings
from app.core.rate_limit import InMemoryRateLimiter, _parse_rate_limit, get_rate_limit_key


def _request_with_scope(*, headers: list[tuple[bytes, bytes]] | None = None, client=None) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/token",
        "headers": headers or [],
        "client": client,
    }
    return Request(scope)


def test_rate_limit_key_uses_client_host_by_default(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_TRUST_PROXY_HEADERS", False, raising=False)
    request = _request_with_scope(
        headers=[(b"x-forwarded-for", b"203.0.113.10, 10.0.0.1")],
        client=("127.0.0.1", 4242),
    )

    assert get_rate_limit_key(request) == "127.0.0.1"


def test_rate_limit_key_uses_forwarded_for_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_TRUST_PROXY_HEADERS", True, raising=False)
    request = _request_with_scope(
        headers=[(b"x-forwarded-for", b"203.0.113.10, 10.0.0.1")],
        client=("127.0.0.1", 4242),
    )

    assert get_rate_limit_key(request) == "203.0.113.10"


def test_rate_limit_key_falls_back_to_unknown_without_ip(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_TRUST_PROXY_HEADERS", False, raising=False)
    request = _request_with_scope(client=None)

    assert get_rate_limit_key(request) == "unknown"


def test_parse_rate_limit_returns_expected_window():
    assert _parse_rate_limit("5/minute") == (5, 60)


def test_parse_rate_limit_rejects_invalid_period():
    try:
        _parse_rate_limit("5/week")
        assert False, "Expected ValueError"
    except ValueError as exc:
        assert "Unsupported rate limit period" in str(exc)


def test_in_memory_limiter_blocks_after_limit():
    limiter = InMemoryRateLimiter()
    assert limiter.check(key="127.0.0.1", bucket="auth_token", limit="2/minute")[0] is True
    assert limiter.check(key="127.0.0.1", bucket="auth_token", limit="2/minute")[0] is True
    allowed, retry_after = limiter.check(key="127.0.0.1", bucket="auth_token", limit="2/minute")
    assert allowed is False
    assert retry_after >= 1
