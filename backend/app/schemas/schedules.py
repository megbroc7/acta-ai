from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ExecutionHistoryBase(BaseModel):
    execution_type: str
    execution_time: datetime
    success: bool
    error_message: Optional[str] = None
    
class ExecutionHistoryCreate(ExecutionHistoryBase):
    schedule_id: int
    user_id: int
    post_id: Optional[int] = None
    
class ExecutionHistoryResponse(ExecutionHistoryBase):
    id: int
    schedule_id: int
    post_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class ScheduleBase(BaseModel):
    name: str
    frequency: str
    time_of_day: str
    
    # Optional fields
    custom_cron: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    topics: Optional[List[str]] = None
    word_count: Optional[int] = None
    include_images: Optional[bool] = None
    tone: Optional[str] = None
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None
    prompt_replacements: Optional[Dict[str, Any]] = None
    post_status: Optional[str] = None
    enable_review: Optional[bool] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    site_id: int
    prompt_template_id: int

class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    time_of_day: Optional[str] = None
    custom_cron: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    topics: Optional[List[str]] = None
    word_count: Optional[int] = None
    include_images: Optional[bool] = None
    tone: Optional[str] = None
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None
    prompt_replacements: Optional[Dict[str, Any]] = None
    post_status: Optional[str] = None
    enable_review: Optional[bool] = None
    is_active: Optional[bool] = None
    site_id: Optional[int] = None
    prompt_template_id: Optional[int] = None
    description: Optional[str] = None

class ScheduleResponse(BaseModel):
    id: int
    name: str
    frequency: str
    time_of_day: str
    custom_cron: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    topics: Optional[List[str]] = None
    word_count: Optional[int] = None
    include_images: Optional[bool] = None
    tone: Optional[str] = None
    category_ids: Optional[List[int]] = None
    tag_ids: Optional[List[int]] = None
    prompt_replacements: Optional[Dict[str, Any]] = None
    post_status: Optional[str] = None
    enable_review: Optional[bool] = None
    is_active: Optional[bool] = None
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    description: Optional[str] = None
    
    # Related data
    site: Optional[Dict[str, Any]] = None
    prompt: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True) 