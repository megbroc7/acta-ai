import uuid
from datetime import datetime

from pydantic import BaseModel


class DailyCount(BaseModel):
    date: str
    count: int


class StatusBreakdown(BaseModel):
    draft: int = 0
    pending_review: int = 0
    published: int = 0
    rejected: int = 0


class PlatformBreakdown(BaseModel):
    platform: str
    count: int


class SchedulerDayHealth(BaseModel):
    date: str
    success: int = 0
    failure: int = 0


class UserActivity(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool = True
    is_admin: bool = False
    created_at: datetime | None = None
    sites: int = 0
    templates: int = 0
    schedules: int = 0
    posts: int = 0
    last_active: datetime | None = None


class MonthlyCost(BaseModel):
    month: str
    estimated_usd: float


class AdminDashboardResponse(BaseModel):
    # Scalar counts
    total_users: int
    total_sites: int
    total_templates: int
    total_schedules: int
    total_posts: int
    active_schedules: int

    # Chart data
    posts_over_time: list[DailyCount]
    status_breakdown: StatusBreakdown
    platform_breakdown: list[PlatformBreakdown]
    scheduler_health: list[SchedulerDayHealth]
    user_activity: list[UserActivity]
    cost_estimates: list[MonthlyCost]
    signups_over_time: list[DailyCount]


# --- Admin user management schemas ---

class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_admin: bool


class AdminPasswordResetResponse(BaseModel):
    temporary_password: str


class AdminUserSite(BaseModel):
    name: str
    platform: str
    is_active: bool


class AdminUserTemplate(BaseModel):
    name: str
    industry: str | None = None


class AdminUserSchedule(BaseModel):
    name: str
    frequency: str
    is_active: bool
    last_run: datetime | None = None


class AdminUserPost(BaseModel):
    title: str
    status: str
    created_at: datetime


class AdminUserError(BaseModel):
    execution_time: datetime
    error_message: str | None = None


class AdminUserDetail(BaseModel):
    sites: list[AdminUserSite]
    templates: list[AdminUserTemplate]
    schedules: list[AdminUserSchedule]
    recent_posts: list[AdminUserPost]
    recent_errors: list[AdminUserError]


# --- Global error log schemas ---

class ErrorLogEntry(BaseModel):
    id: uuid.UUID
    execution_time: datetime
    execution_type: str
    error_message: str | None = None
    user_email: str
    user_full_name: str
    schedule_name: str


class ErrorLogResponse(BaseModel):
    total: int
    entries: list[ErrorLogEntry]


# --- Schedule oversight schemas ---

class ScheduleOversightEntry(BaseModel):
    id: uuid.UUID
    name: str
    frequency: str
    is_active: bool
    next_run: datetime | None = None
    last_run: datetime | None = None
    user_email: str
    user_full_name: str
    site_name: str
    site_platform: str
    template_name: str
    template_industry: str | None = None
