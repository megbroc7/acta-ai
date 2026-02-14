import base64
import logging
from dataclasses import dataclass

import httpx

from app.models.blog_post import BlogPost
from app.models.site import Site

logger = logging.getLogger(__name__)


class PublishError(Exception):
    """Raised when publishing to a platform fails."""


@dataclass
class PublishResult:
    platform_post_id: str
    published_url: str


def _wp_auth_headers(site: Site) -> dict:
    """Build Basic Auth header from site credentials."""
    credentials = base64.b64encode(
        f"{site.username}:{site.app_password}".encode()
    ).decode()
    return {"Authorization": f"Basic {credentials}"}


async def publish_to_wordpress(post: BlogPost, site: Site) -> PublishResult:
    """Publish a blog post to WordPress via REST API."""
    headers = _wp_auth_headers(site)
    payload = {
        "title": post.title,
        "content": post.content,
        "status": "publish",
    }
    if post.excerpt:
        payload["excerpt"] = post.excerpt
    if post.categories:
        payload["categories"] = [int(c) for c in post.categories]
    if post.tags:
        payload["tags"] = [int(t) for t in post.tags]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{site.api_url}/wp/v2/posts",
                headers=headers,
                json=payload,
            )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise PublishError(f"Failed to connect to WordPress: {exc}") from exc

    if resp.status_code < 200 or resp.status_code >= 300:
        detail = resp.text[:500] if resp.text else "No response body"
        raise PublishError(
            f"WordPress returned HTTP {resp.status_code}: {detail}"
        )

    data = resp.json()
    return PublishResult(
        platform_post_id=str(data["id"]),
        published_url=data["link"],
    )


def _shopify_auth_headers(site: Site) -> dict:
    """Build Shopify authentication headers."""
    return {
        "X-Shopify-Access-Token": site.api_key,
        "Content-Type": "application/json",
    }


async def publish_to_shopify(post: BlogPost, site: Site) -> PublishResult:
    """Publish a blog post to Shopify as a blog article."""
    if not site.default_blog_id:
        raise PublishError(
            "Shopify site has no blog selected. Edit the site and choose a blog."
        )

    headers = _shopify_auth_headers(site)
    payload = {
        "article": {
            "title": post.title,
            "body_html": post.content,
            "published": True,
        }
    }
    if post.tags:
        payload["article"]["tags"] = ", ".join(post.tags)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{site.api_url}/blogs/{site.default_blog_id}/articles.json",
                headers=headers,
                json=payload,
            )
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        raise PublishError(f"Failed to connect to Shopify: {exc}") from exc

    if resp.status_code < 200 or resp.status_code >= 300:
        detail = resp.text[:500] if resp.text else "No response body"
        raise PublishError(
            f"Shopify returned HTTP {resp.status_code}: {detail}"
        )

    data = resp.json()
    article = data["article"]
    # Build the public article URL from the site URL
    published_url = f"{site.url.rstrip('/')}/blogs/{site.default_blog_id}/{article['handle']}"
    return PublishResult(
        platform_post_id=str(article["id"]),
        published_url=published_url,
    )


async def publish_to_wix(post: BlogPost, site: Site) -> PublishResult:
    """Stub — Wix publishing not yet implemented."""
    raise PublishError("Wix publishing not yet implemented")


async def publish_post(post: BlogPost, site: Site) -> PublishResult:
    """Dispatch publishing to the correct platform handler."""
    dispatchers = {
        "wordpress": publish_to_wordpress,
        "shopify": publish_to_shopify,
        "wix": publish_to_wix,
    }
    handler = dispatchers.get(site.platform)
    if not handler:
        raise PublishError(f"Unknown platform: {site.platform}")

    logger.info("Publishing post %s to %s site '%s'", post.id, site.platform, site.name)
    result = await handler(post, site)
    logger.info("Published successfully: %s", result.published_url)
    return result
