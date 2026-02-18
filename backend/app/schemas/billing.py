from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TierLimitsResponse(BaseModel):
    sites: int | None
    templates: int | None
    schedules: int | None
    image_sources: list[str]
    review_workflow: bool
    wp_pending_review: bool
    voice_match: bool
    revise_with_ai: bool
    dalle_quality: str | None


class UsageResponse(BaseModel):
    sites: int
    templates: int
    schedules: int


class TierInfoResponse(BaseModel):
    effective_tier: str | None
    subscription_tier: str | None
    trial_ends_at: datetime | None
    trial_active: bool
    limits: TierLimitsResponse | None
    usage: UsageResponse
