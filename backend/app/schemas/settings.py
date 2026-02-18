import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1)
    email: EmailStr | None = None
    timezone: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ApiKeyStatus(BaseModel):
    openai: bool
    unsplash: bool


class DeleteAccount(BaseModel):
    password: str


class UsageSummary(BaseModel):
    total_posts: int
    published_posts: int
    pending_review_posts: int
    draft_posts: int
    total_executions: int
    successful_executions: int
    failed_executions: int
    total_tokens: int
    estimated_cost_usd: float
    image_cost_usd: float
    total_cost_usd: float
    member_since: datetime
