import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    site_id: uuid.UUID | None = None
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    excerpt: str | None = None
    featured_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    image_alt_text: str | None = None
    categories: list[int] = []
    tags: list[int] = []
    status: str = "draft"
    prompt_template_id: uuid.UUID | None = None
    system_prompt_used: str | None = None
    topic_prompt_used: str | None = None
    content_prompt_used: str | None = None


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    excerpt: str | None = None
    featured_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    image_alt_text: str | None = None
    categories: list[int] | None = None
    tags: list[int] | None = None
    status: str | None = None


class PostSiteInfo(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    platform: str
    model_config = {"from_attributes": True}


class PostResponse(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID | None
    schedule_id: uuid.UUID | None
    prompt_template_id: uuid.UUID | None
    title: str
    content: str
    excerpt: str | None
    featured_image_url: str | None
    meta_title: str | None = None
    meta_description: str | None = None
    image_alt_text: str | None = None
    categories: list
    tags: list
    status: str
    review_notes: str | None
    platform_post_id: str | None
    published_url: str | None
    system_prompt_used: str | None
    topic_prompt_used: str | None
    content_prompt_used: str | None
    created_at: datetime
    published_at: datetime | None
    updated_at: datetime | None = None
    site: PostSiteInfo | None = None
    model_config = {"from_attributes": True}


class MarkPublishedRequest(BaseModel):
    published_url: str | None = None


class RejectRequest(BaseModel):
    review_notes: str = Field(min_length=1)


class BulkActionRequest(BaseModel):
    post_ids: list[uuid.UUID] = Field(min_length=1)


class BulkRejectRequest(BaseModel):
    post_ids: list[uuid.UUID] = Field(min_length=1)
    review_notes: str = Field(min_length=1)


class ReviseRequest(BaseModel):
    feedback: str = Field(min_length=1, max_length=5000)


class PostCountsResponse(BaseModel):
    pending_review: int = 0
    draft: int = 0
    published: int = 0
    rejected: int = 0
