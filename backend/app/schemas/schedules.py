import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class PostStatusOption(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISH = "publish"


class TopicItem(BaseModel):
    topic: str = Field(min_length=1)
    experience: str | None = None


class ScheduleCreate(BaseModel):
    name: str = Field(min_length=1)
    site_id: uuid.UUID
    prompt_template_id: uuid.UUID
    frequency: str  # daily, weekly, monthly, custom
    custom_cron: str | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    time_of_day: str = Field(pattern=r"^\d{2}:\d{2}$")
    timezone: str = "UTC"
    topics: list[TopicItem] = Field(min_length=1)
    word_count: int | None = None
    tone: str | None = None
    include_images: bool = False
    category_ids: list[int] = []
    tag_ids: list[int] = []
    prompt_replacements: dict = {}
    post_status: PostStatusOption = PostStatusOption.DRAFT
    enable_review: bool = True  # deprecated — use post_status instead


class ScheduleUpdate(BaseModel):
    name: str | None = None
    site_id: uuid.UUID | None = None
    prompt_template_id: uuid.UUID | None = None
    frequency: str | None = None
    custom_cron: str | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    time_of_day: str | None = None
    timezone: str | None = None
    topics: list[TopicItem] | None = None
    word_count: int | None = None
    tone: str | None = None
    include_images: bool | None = None
    category_ids: list[int] | None = None
    tag_ids: list[int] | None = None
    prompt_replacements: dict | None = None
    post_status: PostStatusOption | None = None
    enable_review: bool | None = None  # deprecated — use post_status instead


class ScheduleSiteInfo(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    platform: str
    model_config = {"from_attributes": True}


class ScheduleTemplateInfo(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    name: str
    site_id: uuid.UUID
    prompt_template_id: uuid.UUID
    frequency: str
    custom_cron: str | None
    day_of_week: int | None
    day_of_month: int | None
    time_of_day: str
    timezone: str
    topics: list
    word_count: int | None
    tone: str | None
    include_images: bool
    category_ids: list
    tag_ids: list
    prompt_replacements: dict
    post_status: str
    enable_review: bool
    is_active: bool
    last_run: datetime | None
    next_run: datetime | None
    retry_count: int
    created_at: datetime
    updated_at: datetime
    site: ScheduleSiteInfo | None = None
    prompt_template: ScheduleTemplateInfo | None = None
    model_config = {"from_attributes": True}


class ExecutionHistoryResponse(BaseModel):
    id: uuid.UUID
    schedule_id: uuid.UUID
    post_id: uuid.UUID | None
    execution_type: str
    execution_time: datetime
    duration_ms: int | None
    success: bool
    error_message: str | None
    model_config = {"from_attributes": True}
