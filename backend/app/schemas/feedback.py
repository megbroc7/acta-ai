import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    category: str = "general"
    message: str = Field(min_length=1)


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category: str
    message: str
    created_at: datetime
    model_config = {"from_attributes": True}
