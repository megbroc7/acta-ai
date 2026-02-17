import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    category: str
    title: str
    message: str
    action_url: str | None = None
    action_label: str | None = None
    is_read: bool
    schedule_id: uuid.UUID | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    count: int
