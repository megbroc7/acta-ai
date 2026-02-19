import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ShopifyInstallUrlRequest(BaseModel):
    site_id: uuid.UUID
    shop_domain: str | None = Field(
        default=None,
        description="Optional myshopify domain override.",
    )


class ShopifyInstallUrlResponse(BaseModel):
    auth_url: str
    shop_domain: str
    expires_at: datetime


class ShopifyBlogOption(BaseModel):
    id: str
    title: str


class ShopifyBlogsResponse(BaseModel):
    connected: bool
    blogs: list[ShopifyBlogOption]
