from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

from ..core.database import get_db
from ..models.blog_schedule import BlogSchedule
from ..models.user import User
from ..models.site import WordPressSite
from ..models.prompt_template import PromptTemplate
from ..services.scheduler import SchedulerService
from .auth import get_current_user

router = APIRouter()
scheduler_service = SchedulerService()

# Pydantic models
class ScheduleCreate(BaseModel):
    name: str
    site_id: int
    prompt_template_id: int
    
    # Scheduling settings
    frequency: str = Field(..., description="Frequency: daily, weekly, monthly, custom")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="0-6 for Monday-Sunday, required for weekly")
    day_of_month: Optional[int] = Field(None, ge=1, le=31, description="1-31, required for monthly")
    time_of_day: str = Field(..., description="HH:MM format")
    custom_cron: Optional[str] = None
    
    # Content settings
    topics: List[str]
    word_count: int = Field(1500, ge=300, le=5000)
    include_images: bool = False
    tone: str = "informative"
    category_ids: List[int] = []
    tag_ids: List[int] = []
    
    # Prompt customization
    prompt_replacements: Dict[str, Any] = {}
    
    # Post settings
    post_status: str = "draft"  # draft or publish
    enable_review: bool = True
    
    @field_validator('frequency')
    @classmethod
    def validate_frequency(cls, v):
        if v not in ['daily', 'weekly', 'monthly', 'custom']:
            raise ValueError('Frequency must be one of: daily, weekly, monthly, custom')
        return v
        
    @field_validator('day_of_week')
    @classmethod
    def validate_day_of_week(cls, v, info):
        values = info.data
        if values.get('frequency') == 'weekly' and v is None:
            raise ValueError('day_of_week is required for weekly frequency')
        return v
        
    @field_validator('day_of_month')
    @classmethod
    def validate_day_of_month(cls, v, info):
        values = info.data
        if values.get('frequency') == 'monthly' and v is None:
            raise ValueError('day_of_month is required for monthly frequency')
        return v
        
    @field_validator('custom_cron')
    @classmethod
    def validate_custom_cron(cls, v, info):
        values = info.data
        if values.get('frequency') == 'custom' and (v is None or not v.strip()):
            raise ValueError('custom_cron is required for custom frequency')
        return v
        
    @field_validator('time_of_day')
    @classmethod
    def validate_time_format(cls, v):
        try:
            datetime.strptime(v, '%H:%M')
        except ValueError:
            raise ValueError('time_of_day must be in HH:MM format')
        return v
        
    @field_validator('post_status')
    @classmethod
    def validate_post_status(cls, v):
        if v not in ['draft', 'publish']:
            raise ValueError('post_status must be either "draft" or "publish"')
        return v

class ScheduleResponse(BaseModel):
    id: int
    name: str
    site_id: int
    prompt_template_id: int
    frequency: str
    day_of_week: Optional[int]
    day_of_month: Optional[int]
    time_of_day: str
    custom_cron: Optional[str]
    topics: List[str]
    word_count: int
    include_images: bool
    tone: str
    category_ids: List[int]
    tag_ids: List[int]
    post_status: str
    enable_review: bool
    is_active: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new blog post schedule."""
    # Verify site exists and belongs to user
    site_stmt = select(WordPressSite).where(
        (WordPressSite.id == schedule_data.site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    site_result = await db.execute(site_stmt)
    site = site_result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Verify prompt template exists and belongs to user
    template_stmt = select(PromptTemplate).where(
        (PromptTemplate.id == schedule_data.prompt_template_id) &
        (PromptTemplate.user_id == current_user.id)
    )
    template_result = await db.execute(template_stmt)
    template = template_result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt template not found"
        )
    
    # Check if user already has a schedule for the same day
    # For daily schedules, we don't allow more than one per day
    if schedule_data.frequency == "daily":
        existing_schedules_stmt = select(BlogSchedule).where(
            (BlogSchedule.user_id == current_user.id) &
            (BlogSchedule.frequency == "daily") &
            (BlogSchedule.is_active == True)
        )
        existing_result = await db.execute(existing_schedules_stmt)
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only have one daily schedule active at a time"
            )
    
    # For weekly schedules, check if there's already a schedule for the same day of week
    elif schedule_data.frequency == "weekly":
        existing_schedules_stmt = select(BlogSchedule).where(
            (BlogSchedule.user_id == current_user.id) &
            (BlogSchedule.frequency == "weekly") &
            (BlogSchedule.day_of_week == schedule_data.day_of_week) &
            (BlogSchedule.is_active == True)
        )
        existing_result = await db.execute(existing_schedules_stmt)
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a schedule for this day of the week"
            )
    
    # For monthly schedules, check if there's already a schedule for the same day of month
    elif schedule_data.frequency == "monthly":
        existing_schedules_stmt = select(BlogSchedule).where(
            (BlogSchedule.user_id == current_user.id) &
            (BlogSchedule.frequency == "monthly") &
            (BlogSchedule.day_of_month == schedule_data.day_of_month) &
            (BlogSchedule.is_active == True)
        )
        existing_result = await db.execute(existing_schedules_stmt)
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a schedule for this day of the month"
            )
    
    # Create new schedule
    new_schedule = BlogSchedule(
        user_id=current_user.id,
        site_id=schedule_data.site_id,
        prompt_template_id=schedule_data.prompt_template_id,
        name=schedule_data.name,
        frequency=schedule_data.frequency,
        day_of_week=schedule_data.day_of_week,
        day_of_month=schedule_data.day_of_month,
        time_of_day=schedule_data.time_of_day,
        custom_cron=schedule_data.custom_cron,
        topics=schedule_data.topics,
        word_count=schedule_data.word_count,
        include_images=schedule_data.include_images,
        tone=schedule_data.tone,
        category_ids=schedule_data.category_ids,
        tag_ids=schedule_data.tag_ids,
        prompt_replacements=schedule_data.prompt_replacements,
        post_status=schedule_data.post_status,
        enable_review=schedule_data.enable_review
    )
    
    db.add(new_schedule)
    await db.commit()
    await db.refresh(new_schedule)
    
    # Schedule the first run
    await scheduler_service.schedule_post(db, new_schedule.id)
    
    return new_schedule

@router.get("/", response_model=List[ScheduleResponse])
async def get_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all blog post schedules for the current user."""
    stmt = select(BlogSchedule).where(BlogSchedule.user_id == current_user.id)
    result = await db.execute(stmt)
    schedules = result.scalars().all()
    return schedules

@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog post schedule."""
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    return schedule

@router.patch("/{schedule_id}/activate", response_model=ScheduleResponse)
async def activate_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a blog post schedule."""
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    schedule.is_active = True
    await db.commit()
    await db.refresh(schedule)
    
    # Schedule the next run
    await scheduler_service.schedule_post(db, schedule.id)
    
    return schedule

@router.patch("/{schedule_id}/deactivate", response_model=ScheduleResponse)
async def deactivate_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivate a blog post schedule."""
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    schedule.is_active = False
    await db.commit()
    await db.refresh(schedule)
    
    # Remove any scheduled jobs
    try:
        job_id = f"schedule_{schedule.id}_"
        scheduler_service.scheduler.remove_job(job_id, ignore_if_not_exists=True)
    except:
        pass
    
    return schedule

@router.post("/{schedule_id}/run-now", response_model=ScheduleResponse)
async def run_schedule_now(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run a schedule immediately."""
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Run the schedule's job immediately
    scheduler_service.scheduler.add_job(
        scheduler_service._generate_and_post,
        trigger='date',
        run_date=datetime.now() + timedelta(seconds=5),
        args=[db, schedule.id],
        id=f"manual_run_schedule_{schedule.id}_{datetime.now().isoformat()}",
        replace_existing=True
    )
    
    return schedule

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a blog post schedule."""
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Remove any scheduled jobs
    try:
        job_id = f"schedule_{schedule.id}_"
        scheduler_service.scheduler.remove_job(job_id, ignore_if_not_exists=True)
    except:
        pass
    
    # Delete the schedule
    await db.delete(schedule)
    await db.commit()

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a blog post schedule."""
    # Get the existing schedule
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Verify site exists and belongs to user
    site_stmt = select(WordPressSite).where(
        (WordPressSite.id == schedule_data.site_id) &
        (WordPressSite.user_id == current_user.id)
    )
    site_result = await db.execute(site_stmt)
    site = site_result.scalars().first()
    
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WordPress site not found"
        )
    
    # Verify prompt template exists and belongs to user
    template_stmt = select(PromptTemplate).where(
        (PromptTemplate.id == schedule_data.prompt_template_id) &
        (PromptTemplate.user_id == current_user.id)
    )
    template_result = await db.execute(template_stmt)
    template = template_result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt template not found"
        )
    
    # Check if user already has a schedule for the same day (excluding this one)
    # For daily schedules, we don't allow more than one per day
    if schedule_data.frequency == "daily":
        existing_schedules_stmt = select(BlogSchedule).where(
            (BlogSchedule.user_id == current_user.id) &
            (BlogSchedule.frequency == "daily") &
            (BlogSchedule.is_active == True) &
            (BlogSchedule.id != schedule_id)
        )
        existing_result = await db.execute(existing_schedules_stmt)
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only have one daily schedule active at a time"
            )
    
    # For weekly schedules, check if there's already a schedule for the same day of week
    elif schedule_data.frequency == "weekly":
        existing_schedules_stmt = select(BlogSchedule).where(
            (BlogSchedule.user_id == current_user.id) &
            (BlogSchedule.frequency == "weekly") &
            (BlogSchedule.day_of_week == schedule_data.day_of_week) &
            (BlogSchedule.is_active == True) &
            (BlogSchedule.id != schedule_id)
        )
        existing_result = await db.execute(existing_schedules_stmt)
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a schedule for this day of the week"
            )
    
    # For monthly schedules, check if there's already a schedule for the same day of month
    elif schedule_data.frequency == "monthly":
        existing_schedules_stmt = select(BlogSchedule).where(
            (BlogSchedule.user_id == current_user.id) &
            (BlogSchedule.frequency == "monthly") &
            (BlogSchedule.day_of_month == schedule_data.day_of_month) &
            (BlogSchedule.is_active == True) &
            (BlogSchedule.id != schedule_id)
        )
        existing_result = await db.execute(existing_schedules_stmt)
        if existing_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a schedule for this day of the month"
            )
    
    # Update schedule fields
    schedule.site_id = schedule_data.site_id
    schedule.prompt_template_id = schedule_data.prompt_template_id
    schedule.name = schedule_data.name
    schedule.frequency = schedule_data.frequency
    schedule.day_of_week = schedule_data.day_of_week
    schedule.day_of_month = schedule_data.day_of_month
    schedule.time_of_day = schedule_data.time_of_day
    schedule.custom_cron = schedule_data.custom_cron
    schedule.topics = schedule_data.topics
    schedule.word_count = schedule_data.word_count
    schedule.include_images = schedule_data.include_images
    schedule.tone = schedule_data.tone
    schedule.category_ids = schedule_data.category_ids
    schedule.tag_ids = schedule_data.tag_ids
    schedule.prompt_replacements = schedule_data.prompt_replacements
    schedule.post_status = schedule_data.post_status
    schedule.enable_review = schedule_data.enable_review
    
    await db.commit()
    await db.refresh(schedule)
    
    # Reschedule the next run
    await scheduler_service.schedule_post(db, schedule.id)
    
    return schedule