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


async def _wp_upload_featured_image(
    image_url: str, site: Site, title: str, alt_text: str | None = None,
) -> int | None:
    """Download an image and upload it to WordPress as a media attachment.

    Returns the WordPress media ID, or None on failure (non-fatal).
    """
    api_url = site.api_url.rstrip("/")
    headers = _wp_auth_headers(site)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Download image to memory
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()

            content_type = img_resp.headers.get("content-type", "image/jpeg")
            # Determine extension from content type
            ext_map = {
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif",
            }
            ext = ext_map.get(content_type, "jpg")
            # Sanitize title for filename
            safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title)[:60].strip()
            filename = f"{safe_title or 'featured'}.{ext}"

            # Upload to WordPress media library
            upload_headers = {
                **headers,
                "Content-Type": content_type,
                "Content-Disposition": f'attachment; filename="{filename}"',
            }
            upload_resp = await client.post(
                f"{api_url}/wp/v2/media",
                headers=upload_headers,
                content=img_resp.content,
            )
            if upload_resp.status_code < 200 or upload_resp.status_code >= 300:
                logger.error(
                    "WordPress media upload failed: HTTP %s — %s",
                    upload_resp.status_code, upload_resp.text[:300],
                )
                return None

            media_id = upload_resp.json().get("id")
            logger.info("Uploaded featured image to WordPress: media_id=%s", media_id)

            # Set alt text on the uploaded media item
            if media_id and alt_text:
                try:
                    await client.post(
                        f"{api_url}/wp/v2/media/{media_id}",
                        headers=headers,
                        json={"alt_text": alt_text},
                    )
                except Exception:
                    logger.warning("Alt text update failed (non-fatal)")

            return media_id
    except Exception as e:
        logger.error("Featured image upload failed: %s", e)
        return None


async def publish_to_wordpress(post: BlogPost, site: Site) -> PublishResult:
    """Publish a blog post to WordPress via REST API."""
    site.api_url = site.api_url.rstrip("/")
    headers = _wp_auth_headers(site)
    payload = {
        "title": post.title,
        "content": post.content,
        "status": "publish",
    }
    # Use meta_description as excerpt if available, else fall back to post.excerpt
    excerpt = post.meta_description or post.excerpt
    if excerpt:
        payload["excerpt"] = excerpt
    if post.categories:
        payload["categories"] = [int(c) for c in post.categories]
    if post.tags:
        payload["tags"] = [int(t) for t in post.tags]

    # Yoast + RankMath SEO meta (shotgun — silently ignored if plugin not installed)
    meta_fields = {}
    if post.meta_title:
        meta_fields["_yoast_wpseo_title"] = post.meta_title
        meta_fields["rank_math_title"] = post.meta_title
    if post.meta_description:
        meta_fields["_yoast_wpseo_metadesc"] = post.meta_description
        meta_fields["rank_math_description"] = post.meta_description
    if meta_fields:
        payload["meta"] = meta_fields

    # Upload featured image if available
    if post.featured_image_url:
        media_id = await _wp_upload_featured_image(
            post.featured_image_url, site, post.title,
            alt_text=post.image_alt_text,
        )
        if media_id:
            payload["featured_media"] = media_id

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


async def publish_to_copy(post: BlogPost, site: Site) -> PublishResult:
    """Copy & Paste platform — no actual publishing, just mark as published."""
    return PublishResult(
        platform_post_id=f"copy-{post.id}",
        published_url=site.url,
    )


async def publish_post(post: BlogPost, site: Site) -> PublishResult:
    """Dispatch publishing to the correct platform handler."""
    dispatchers = {
        "wordpress": publish_to_wordpress,
        "shopify": publish_to_shopify,
        "wix": publish_to_wix,
        "copy": publish_to_copy,
    }
    handler = dispatchers.get(site.platform)
    if not handler:
        raise PublishError(f"Unknown platform: {site.platform}")

    logger.info("Publishing post %s to %s site '%s'", post.id, site.platform, site.name)
    result = await handler(post, site)
    logger.info("Published successfully: %s", result.published_url)
    return result
