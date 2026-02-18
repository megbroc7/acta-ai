import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class Platform(StrEnum):
    wordpress = "wordpress"
    shopify = "shopify"
    wix = "wix"
    copy = "copy"


class SiteCreate(BaseModel):
    name: str = Field(min_length=1)
    url: str = Field(min_length=1)
    api_url: str | None = None
    platform: Platform
    username: str | None = None
    app_password: str | None = None
    api_key: str | None = None
    default_blog_id: str | None = None

    @model_validator(mode="after")
    def check_platform_credentials(self):
        if self.platform == Platform.copy:
            return self
        if not self.api_url:
            raise ValueError(f"{self.platform.value.title()} sites require api_url")
        if self.platform == Platform.wordpress:
            if not self.username or not self.app_password:
                raise ValueError("WordPress sites require username and app_password")
        elif self.platform in (Platform.shopify, Platform.wix):
            if not self.api_key:
                raise ValueError(f"{self.platform.value.title()} sites require api_key")
        return self


class SiteUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    api_url: str | None = None
    username: str | None = None
    app_password: str | None = None
    api_key: str | None = None
    default_blog_id: str | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    platform_id: str
    name: str
    model_config = {"from_attributes": True}


class TagResponse(BaseModel):
    id: uuid.UUID
    platform_id: str
    name: str
    model_config = {"from_attributes": True}


class SiteResponse(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    api_url: str
    platform: str
    username: str | None
    default_blog_id: str | None
    is_active: bool
    last_health_check: datetime | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class SiteDetail(SiteResponse):
    categories: list[CategoryResponse] = []
    tags: list[TagResponse] = []


class ConnectionTestRequest(BaseModel):
    platform: Platform
    api_url: str | None = None
    username: str | None = None
    app_password: str | None = None
    api_key: str | None = None


class BlogOption(BaseModel):
    id: str
    title: str


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    blogs: list[BlogOption] | None = None
