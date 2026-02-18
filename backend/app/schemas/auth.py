import uuid
from datetime import datetime, timezone as tz
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, computed_field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_admin: bool = False
    timezone: str
    subscription_tier: str | None = None
    trial_ends_at: datetime | None = None
    created_at: datetime

    @computed_field
    @property
    def trial_active(self) -> bool:
        if self.subscription_tier:
            return False
        if self.trial_ends_at and self.trial_ends_at > datetime.now(tz.utc):
            return True
        return False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
