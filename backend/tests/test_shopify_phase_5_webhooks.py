import base64
import hashlib
import hmac
import json
import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api import shopify as shopify_api
from app.api.shopify import router as shopify_router
from app.core.config import settings
from app.models.site import Site
from app.models.shopify_connection import ShopifyConnection
from app.services import shopify_oauth
from app.services.shopify_connections import disconnect_shop_connections


class _FakeScalarsResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self

    def all(self):
        return self._values


class _FakeSequenceDB:
    def __init__(self, execute_results):
        self._execute_results = list(execute_results)
        self.committed = False

    async def execute(self, *_args, **_kwargs):
        if not self._execute_results:
            return _FakeScalarsResult([])
        return self._execute_results.pop(0)

    async def commit(self):
        self.committed = True


def _webhook_request(
    *,
    path: str,
    headers: dict[str, str],
    payload: dict | None = None,
) -> Request:
    body = json.dumps(payload or {}).encode("utf-8")
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "query_string": b"",
        "headers": [(k.lower().encode("utf-8"), v.encode("utf-8")) for k, v in headers.items()],
        "scheme": "http",
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
    }
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


@pytest.mark.asyncio
async def test_shopify_phase_5_webhook_routes_are_canonical():
    route_index = {(route.path, tuple(sorted(route.methods or []))) for route in shopify_router.routes}
    assert ("/shopify/webhooks/customers/data_request", ("POST",)) in route_index
    assert ("/shopify/webhooks/customers/redact", ("POST",)) in route_index
    assert ("/shopify/webhooks/shop/redact", ("POST",)) in route_index
    assert ("/shopify/webhooks/app/uninstalled", ("POST",)) in route_index
    assert ("/shopify/webhooks/compliance", ("POST",)) in route_index


def test_verify_webhook_hmac_accepts_valid_signature(monkeypatch):
    monkeypatch.setattr(settings, "SHOPIFY_APP_CLIENT_SECRET", "phase5-secret", raising=False)
    raw_body = b'{"topic":"customers/redact"}'
    signature = base64.b64encode(
        hmac.new(b"phase5-secret", raw_body, hashlib.sha256).digest()
    ).decode("utf-8")

    assert shopify_oauth.verify_webhook_hmac(raw_body, signature) is True
    assert shopify_oauth.verify_webhook_hmac(raw_body, "invalid-signature") is False


@pytest.mark.asyncio
async def test_customers_data_request_rejects_invalid_hmac(monkeypatch):
    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    monkeypatch.setattr(shopify_oauth, "verify_webhook_hmac", lambda _body, _hmac: False)
    request = _webhook_request(
        path=f"{settings.API_V1_STR}/shopify/webhooks/customers/data_request",
        headers={
            "X-Shopify-Hmac-Sha256": "bad",
            "X-Shopify-Topic": "customers/data_request",
            "X-Shopify-Shop-Domain": "acta-blog-dev.myshopify.com",
        },
        payload={"shop_id": 1},
    )

    with pytest.raises(HTTPException, match="Invalid Shopify webhook signature") as exc:
        await shopify_api.customers_data_request_webhook(request=request)

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_customers_redact_accepts_valid_webhook(monkeypatch):
    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    monkeypatch.setattr(shopify_oauth, "verify_webhook_hmac", lambda _body, _hmac: True)
    request = _webhook_request(
        path=f"{settings.API_V1_STR}/shopify/webhooks/customers/redact",
        headers={
            "X-Shopify-Hmac-Sha256": "ok",
            "X-Shopify-Topic": "customers/redact",
            "X-Shopify-Shop-Domain": "acta-blog-dev.myshopify.com",
            "X-Shopify-Webhook-Id": "phase5-webhook-id",
        },
        payload={"shop_id": 1, "customer": {"id": 2}},
    )

    response = await shopify_api.customers_redact_webhook(request=request)

    assert response == {"status": "ok"}


@pytest.mark.asyncio
async def test_compliance_webhook_accepts_shop_redact_topic(monkeypatch):
    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    monkeypatch.setattr(shopify_oauth, "verify_webhook_hmac", lambda _body, _hmac: True)
    request = _webhook_request(
        path=f"{settings.API_V1_STR}/shopify/webhooks/compliance",
        headers={
            "X-Shopify-Hmac-Sha256": "ok",
            "X-Shopify-Topic": "shop/redact",
            "X-Shopify-Shop-Domain": "acta-blog-dev.myshopify.com",
        },
        payload={"shop_id": 1},
    )

    response = await shopify_api.compliance_webhook(request=request)

    assert response == {"status": "ok"}


@pytest.mark.asyncio
async def test_disconnect_shop_connections_marks_records_inactive_and_clears_tokens():
    site_id = uuid.uuid4()
    user_id = uuid.uuid4()
    now_connected = ShopifyConnection(
        id=uuid.uuid4(),
        user_id=user_id,
        site_id=site_id,
        shop_domain="https://acta-blog-dev.myshopify.com",
        access_token_encrypted="encrypted-token",
        scopes="read_content,write_content",
        is_active=True,
        disconnected_at=None,
    )
    matching_site = Site(
        id=site_id,
        user_id=user_id,
        name="Acta Shopify",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
        api_key="legacy-shopify-token",
    )
    other_site = Site(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Other Shopify",
        url="https://other-shop.myshopify.com",
        api_url="https://other-shop.myshopify.com/admin/api/2026-01",
        platform="shopify",
        api_key="other-token",
    )
    db = _FakeSequenceDB(
        [
            _FakeScalarsResult([now_connected]),
            _FakeScalarsResult([matching_site, other_site]),
        ]
    )

    summary = await disconnect_shop_connections(
        db,
        shop_domain="acta-blog-dev.myshopify.com",
    )

    assert summary["matched_connections"] == 1
    assert summary["disconnected_connections"] == 1
    assert summary["matched_sites"] == 1
    assert summary["cleared_site_tokens"] == 1
    assert now_connected.is_active is False
    assert now_connected.disconnected_at is not None
    assert matching_site.api_key is None
    assert other_site.api_key == "other-token"


@pytest.mark.asyncio
async def test_app_uninstalled_disconnects_and_commits(monkeypatch):
    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    monkeypatch.setattr(shopify_oauth, "verify_webhook_hmac", lambda _body, _hmac: True)

    called = {}

    async def _fake_disconnect(_db, *, shop_domain):
        called["shop_domain"] = shop_domain
        return {
            "matched_connections": 1,
            "disconnected_connections": 1,
            "matched_sites": 1,
            "cleared_site_tokens": 1,
        }

    monkeypatch.setattr(shopify_api, "disconnect_shop_connections", _fake_disconnect)
    db = _FakeSequenceDB([])
    request = _webhook_request(
        path=f"{settings.API_V1_STR}/shopify/webhooks/app/uninstalled",
        headers={
            "X-Shopify-Hmac-Sha256": "ok",
            "X-Shopify-Topic": "app/uninstalled",
            "X-Shopify-Shop-Domain": "acta-blog-dev.myshopify.com",
            "X-Shopify-Webhook-Id": "uninstall-webhook-id",
        },
        payload={"id": 123, "name": "Acta Shop"},
    )

    response = await shopify_api.app_uninstalled_webhook(request=request, db=db)

    assert response == {"status": "ok"}
    assert called["shop_domain"] == "acta-blog-dev.myshopify.com"
    assert db.committed is True
