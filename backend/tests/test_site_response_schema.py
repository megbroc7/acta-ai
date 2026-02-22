from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.schemas.sites import SiteResponse


def test_site_response_allows_missing_username_attribute():
    site = SimpleNamespace(
        id=uuid4(),
        name="Shopify Test Site",
        url="https://acta-blog-dev.myshopify.com",
        api_url="https://acta-blog-dev.myshopify.com/admin/api/2026-01",
        platform="shopify",
        default_blog_id=None,
        is_active=True,
        last_health_check=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    response = SiteResponse.model_validate(site)

    assert response.username is None
