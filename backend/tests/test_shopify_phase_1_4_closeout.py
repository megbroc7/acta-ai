import uuid
import inspect
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from starlette.requests import Request

from app.api.posts import _ensure_shopify_publish_token
from app.api.shopify import oauth_callback, router as shopify_router
from app.core.config import settings
from app.models.blog_post import BlogPost
from app.models.site import Site
from app.models.shopify_connection import ShopifyConnection
from app.services import publishing as publishing_service
from app.services import scheduler as scheduler_service
from app.services import shopify_oauth
from app.services.publishing import PublishError, publish_to_shopify
from app.services.shopify_connections import upsert_site_connection


class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDB:
    def __init__(self, value=None):
        self.value = value
        self.added = []
        self.committed = False

    async def execute(self, *_args, **_kwargs):
        return _FakeScalarResult(self.value)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


def _request_for_query(query_string: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": f"{settings.API_V1_STR}/shopify/callback",
        "query_string": query_string.encode("utf-8"),
        "headers": [],
        "scheme": "http",
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
    }
    return Request(scope)


def _extract_redirect_query(response) -> dict:
    parsed = urlparse(response.headers["location"])
    return parse_qs(parsed.query)


@pytest.mark.asyncio
async def test_shopify_oauth_contract_routes_are_canonical():
    route_index = {(route.path, tuple(sorted(route.methods or []))) for route in shopify_router.routes}
    assert ("/shopify/install-url", ("POST",)) in route_index
    assert ("/shopify/callback", ("GET",)) in route_index
    assert ("/shopify/sites/{site_id}/blogs", ("GET",)) in route_index


def test_validate_granted_scopes_rejects_missing_required_scope():
    with pytest.raises(shopify_oauth.ShopifyOAuthError, match="missing required scopes"):
        shopify_oauth.validate_granted_scopes("write_content")


def test_validate_granted_scopes_accepts_required_set():
    shopify_oauth.validate_granted_scopes("read_content,write_content")


@pytest.mark.asyncio
async def test_callback_missing_parameters_redirects_to_site_from_state(monkeypatch):
    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    state_token, _ = shopify_oauth.create_state_token(
        user_id=str(uuid.uuid4()),
        site_id=str(uuid.uuid4()),
        shop_domain="acta-blog-dev.myshopify.com",
    )
    request = _request_for_query(f"state={state_token}")

    response = await oauth_callback(request=request, db=_FakeDB())
    query = _extract_redirect_query(response)

    assert "/sites/" in response.headers["location"]
    assert "shopify_error" in query
    assert "Missing Shopify OAuth callback parameters" in query["shopify_error"][0]


@pytest.mark.asyncio
async def test_callback_invalid_hmac_redirects_to_site_from_state(monkeypatch):
    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    state_token, _ = shopify_oauth.create_state_token(
        user_id=str(uuid.uuid4()),
        site_id=str(uuid.uuid4()),
        shop_domain="acta-blog-dev.myshopify.com",
    )
    monkeypatch.setattr(shopify_oauth, "verify_callback_hmac", lambda _raw: False)
    request = _request_for_query(
        f"state={state_token}&code=test_code&shop=acta-blog-dev.myshopify.com&hmac=bad"
    )

    response = await oauth_callback(request=request, db=_FakeDB())
    query = _extract_redirect_query(response)

    assert "/sites/" in response.headers["location"]
    assert "shopify_error" in query
    assert "Invalid Shopify callback signature" in query["shopify_error"][0]


@pytest.mark.asyncio
async def test_callback_success_uses_encrypted_flow_and_clears_plaintext_token(monkeypatch):
    user_id = uuid.uuid4()
    site_id = uuid.uuid4()
    state_token, _ = shopify_oauth.create_state_token(
        user_id=str(user_id),
        site_id=str(site_id),
        shop_domain="acta-blog-dev.myshopify.com",
    )
    site = SimpleNamespace(
        id=site_id,
        user_id=user_id,
        platform="shopify",
        url="https://old-url.example",
        api_url="https://old-url.example/admin/api/2026-01",
        api_key="legacy-plaintext-token",
        default_blog_id=None,
        last_health_check=None,
    )
    fake_db = _FakeDB(site)

    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    monkeypatch.setattr(shopify_oauth, "verify_callback_hmac", lambda _raw: True)

    async def _fake_exchange(_shop, _code):
        return {"access_token": "offline-token", "scope": "read_content,write_content"}

    async def _fake_upsert(*_args, **_kwargs):
        return None

    async def _fake_fetch(_api_url, _token):
        return [{"id": "125735862613", "title": "News"}]

    monkeypatch.setattr(shopify_oauth, "exchange_access_token", _fake_exchange)
    monkeypatch.setattr(shopify_oauth, "fetch_blogs", _fake_fetch)
    monkeypatch.setattr("app.api.shopify.upsert_site_connection", _fake_upsert)

    request = _request_for_query(
        f"state={state_token}&code=test_code&shop=acta-blog-dev.myshopify.com&hmac=ok"
    )
    response = await oauth_callback(request=request, db=fake_db)

    assert fake_db.committed is True
    assert site.api_key is None
    assert site.url == "https://acta-blog-dev.myshopify.com"
    assert site.api_url == "https://acta-blog-dev.myshopify.com/admin/api/2026-01"
    assert site.default_blog_id == "125735862613"
    assert f"/sites/{site_id}/edit?shopify_connected=1" in response.headers["location"]


@pytest.mark.asyncio
async def test_callback_rejects_missing_required_scopes(monkeypatch):
    user_id = uuid.uuid4()
    site_id = uuid.uuid4()
    state_token, _ = shopify_oauth.create_state_token(
        user_id=str(user_id),
        site_id=str(site_id),
        shop_domain="acta-blog-dev.myshopify.com",
    )
    site = SimpleNamespace(
        id=site_id,
        user_id=user_id,
        platform="shopify",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        api_key=None,
        default_blog_id=None,
        last_health_check=None,
    )
    fake_db = _FakeDB(site)

    monkeypatch.setattr(shopify_oauth, "ensure_shopify_oauth_configured", lambda: None)
    monkeypatch.setattr(shopify_oauth, "verify_callback_hmac", lambda _raw: True)

    async def _fake_exchange(_shop, _code):
        return {"access_token": "offline-token", "scope": "write_content"}

    monkeypatch.setattr(shopify_oauth, "exchange_access_token", _fake_exchange)

    request = _request_for_query(
        f"state={state_token}&code=test_code&shop=acta-blog-dev.myshopify.com&hmac=ok"
    )
    response = await oauth_callback(request=request, db=fake_db)
    query = _extract_redirect_query(response)

    assert f"/sites/{site_id}/edit" in response.headers["location"]
    assert "shopify_error" in query
    assert "missing required scopes" in query["shopify_error"][0]


@pytest.mark.asyncio
async def test_reconnect_upsert_updates_existing_row_not_duplicate():
    site = Site(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Shop",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
    )
    existing = ShopifyConnection(
        id=uuid.uuid4(),
        user_id=site.user_id,
        site_id=site.id,
        shop_domain="acta-blog-dev.myshopify.com",
        access_token_encrypted="old-token",
        scopes="write_content",
        is_active=True,
    )
    db = _FakeDB(existing)

    connection = await upsert_site_connection(
        db,
        site=site,
        shop_domain="acta-blog-dev.myshopify.com",
        access_token="new-token",
        scopes="read_content,write_content",
    )

    assert connection is existing
    assert connection.scopes == "read_content,write_content"
    assert connection.access_token_encrypted != "old-token"
    assert db.added == []


class _MockHTTPResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


@pytest.mark.asyncio
async def test_publish_to_shopify_success_returns_article_metadata(monkeypatch):
    site = Site(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Acta Shop",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
        api_key="offline-token",
        default_blog_id="125735862613",
    )
    post = BlogPost(
        id=uuid.uuid4(),
        user_id=site.user_id,
        site_id=site.id,
        title="Closeout Publish",
        content="<p>Body</p>",
        tags=["phase-1-4"],
    )

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, *_args, **_kwargs):
            return _MockHTTPResponse(
                200,
                {
                    "data": {
                        "articleCreate": {
                            "article": {
                                "id": "gid://shopify/Article/1",
                                "handle": "closeout-publish",
                                "blog": {"handle": "news"},
                            },
                            "userErrors": [],
                        }
                    }
                },
            )

    monkeypatch.setattr(publishing_service.httpx, "AsyncClient", lambda *args, **kwargs: _FakeClient())

    result = await publish_to_shopify(post, site)

    assert result.platform_post_id == "gid://shopify/Article/1"
    assert result.published_url == "https://acta-blog-dev.myshopify.com/blogs/news/closeout-publish"


@pytest.mark.asyncio
async def test_publish_to_shopify_surfaces_graphql_user_errors(monkeypatch):
    site = Site(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Acta Shop",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
        api_key="offline-token",
        default_blog_id="not-a-blog",
    )
    post = BlogPost(
        id=uuid.uuid4(),
        user_id=site.user_id,
        site_id=site.id,
        title="Closeout Publish",
        content="<p>Body</p>",
    )

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, *_args, **_kwargs):
            return _MockHTTPResponse(
                200,
                {
                    "data": {
                        "articleCreate": {
                            "article": None,
                            "userErrors": [{"field": ["article", "blogId"], "message": "Invalid blogId"}],
                        }
                    }
                },
            )

    monkeypatch.setattr(publishing_service.httpx, "AsyncClient", lambda *args, **kwargs: _FakeClient())

    with pytest.raises(PublishError, match="Invalid blogId"):
        await publish_to_shopify(post, site)


@pytest.mark.asyncio
async def test_ensure_shopify_publish_token_uses_encrypted_connection(monkeypatch):
    site = Site(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Acta Shop",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
        api_key=None,
        default_blog_id="125735862613",
    )
    post = BlogPost(
        id=uuid.uuid4(),
        user_id=site.user_id,
        site_id=site.id,
        title="Closeout Publish",
        content="<p>Body</p>",
    )
    post.site = site

    async def _fake_resolve(_db, *, site):
        assert site.platform == "shopify"
        return "resolved-token"

    monkeypatch.setattr("app.api.posts.resolve_site_access_token", _fake_resolve)

    await _ensure_shopify_publish_token(_FakeDB(), post)

    assert post.site.api_key == "resolved-token"


@pytest.mark.asyncio
async def test_ensure_shopify_publish_token_raises_if_disconnected(monkeypatch):
    site = Site(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Acta Shop",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
        api_key=None,
        default_blog_id="125735862613",
    )
    post = BlogPost(
        id=uuid.uuid4(),
        user_id=site.user_id,
        site_id=site.id,
        title="Closeout Publish",
        content="<p>Body</p>",
    )
    post.site = site

    async def _fake_resolve(_db, *, site):
        assert site.platform == "shopify"
        return None

    monkeypatch.setattr("app.api.posts.resolve_site_access_token", _fake_resolve)

    with pytest.raises(PublishError, match="Shopify site is not connected"):
        await _ensure_shopify_publish_token(_FakeDB(), post)


def test_scheduler_autopublish_path_resolves_encrypted_shopify_token():
    source = inspect.getsource(scheduler_service.execute_schedule)
    assert "if site.platform == \"shopify\" and not site.api_key" in source
    assert "resolve_site_access_token(db, site=site)" in source
    assert "site.api_key = token" in source


def test_scheduler_publish_failure_keeps_generated_post_and_notifies():
    source = inspect.getsource(scheduler_service.execute_schedule)
    assert "post.status = \"draft\"" in source
    assert "create_publish_failure_notification" in source
