from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy import select, update, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field, field_validator, ConfigDict

from ..core.database import get_db
from ..models.user import User
from ..models.site import WordPressSite
from ..models.prompt_template import PromptTemplate
from ..models.blog_schedule import BlogSchedule, BlogPost
from ..models.execution_history import ExecutionHistory
from ..schemas.schedules import (
    ScheduleCreate, 
    ScheduleUpdate, 
    ScheduleResponse,
    ExecutionHistoryResponse
)
from ..services.scheduler import SchedulerService
from .auth import get_current_user
from ..services.scheduler_utils import safe_remove_job

router = APIRouter()
scheduler_service = SchedulerService()

# Field validators for API-level validation
def validate_frequency(v):
    allowed = ["daily", "weekly", "monthly", "custom"]
    if v not in allowed:
        raise ValueError(f"frequency must be one of {allowed}")
    return v

def validate_day_of_week(v, frequency):
    if frequency == "weekly" and (v is None or not (0 <= v <= 6)):
        raise ValueError("day_of_week must be between 0-6 for weekly frequency")
    return v

def validate_day_of_month(v, frequency):
    if frequency == "monthly" and (v is None or not (1 <= v <= 31)):
        raise ValueError("day_of_month must be between 1-31 for monthly frequency")
    return v

def validate_custom_cron(v, frequency):
    if frequency == "custom" and not v:
        raise ValueError("custom_cron is required for custom frequency")
    return v

def validate_time_format(v):
    try:
        hour, minute = map(int, v.split(':'))
        if not (0 <= hour < 24 and 0 <= minute < 60):
            raise ValueError()
    except (ValueError, AttributeError):
        raise ValueError("time_of_day must be in format HH:MM")
    return v

def validate_post_status(v):
    allowed = ["draft", "publish"]
    if v not in allowed:
        raise ValueError(f"post_status must be one of {allowed}")
    return v

# API routes
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
    
    # Create a serializable response with site and prompt data
    # Create a dictionary to hold our processed schedule data
    schedule_dict = new_schedule.__dict__.copy()
    
    # Add next_run_at field that the frontend expects, mirroring next_run
    if "next_run" in schedule_dict:
        next_run = schedule_dict["next_run"]
        if next_run and hasattr(next_run, "isoformat"):
            # Use ISO format for datetime objects to ensure proper JavaScript parsing
            schedule_dict["next_run_at"] = next_run.isoformat()
        else:
            # Otherwise just copy the value
            schedule_dict["next_run_at"] = next_run
    
    # Add site data if available
    if new_schedule.site_id:
        # Create a dictionary with only the fields needed by the frontend
        site_data = {
            "id": site.id,
            "name": site.name,
            "url": site.url,
            "api_url": site.api_url,
            "username": site.username,
            "created_at": str(site.created_at)
        }
        
        # Add the site data to the schedule dictionary
        schedule_dict["site"] = site_data
    
    # Add prompt template data if available
    if new_schedule.prompt_template_id:
        # Create a dictionary with only the fields needed by the frontend
        prompt_data = {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "variables": template.variables
        }
        
        # Add the prompt data to the schedule dictionary
        schedule_dict["prompt"] = prompt_data
    
    # Create a new schedule object with the site and prompt data included
    from types import SimpleNamespace
    processed_schedule = SimpleNamespace(**schedule_dict)
    
    return processed_schedule

@router.get("/", response_model=List[ScheduleResponse])
async def get_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all blog post schedules for the current user."""
    stmt = select(BlogSchedule).where(BlogSchedule.user_id == current_user.id)
    result = await db.execute(stmt)
    schedules = result.scalars().all()
    
    # Process schedules to handle site and prompt template fields
    processed_schedules = []
    
    # Get all prompt template IDs from the schedules
    prompt_template_ids = [schedule.prompt_template_id for schedule in schedules if schedule.prompt_template_id]
    
    # Fetch all prompt templates at once for efficiency
    prompt_templates = {}
    if prompt_template_ids:
        prompt_stmt = select(PromptTemplate).where(PromptTemplate.id.in_(prompt_template_ids))
        prompt_result = await db.execute(prompt_stmt)
        for prompt in prompt_result.scalars().all():
            prompt_templates[prompt.id] = prompt
    
    # Get all site IDs from the schedules
    site_ids = [schedule.site_id for schedule in schedules if schedule.site_id]
    
    # Fetch all sites at once for efficiency
    sites = {}
    if site_ids:
        site_stmt = select(WordPressSite).where(WordPressSite.id.in_(site_ids))
        site_result = await db.execute(site_stmt)
        for site in site_result.scalars().all():
            sites[site.id] = site
    
    for schedule in schedules:
        # Create a copy of the schedule
        schedule_dict = schedule.__dict__.copy()
        schedule_dict["site"] = None
        schedule_dict["prompt"] = None
        
        # Add next_run_at field that the frontend expects, mirroring next_run
        if "next_run" in schedule_dict:
            next_run = schedule_dict["next_run"]
            if next_run and hasattr(next_run, "isoformat"):
                # Use ISO format for datetime objects to ensure proper JavaScript parsing
                schedule_dict["next_run_at"] = next_run.isoformat()
            else:
                # Otherwise just copy the value
                schedule_dict["next_run_at"] = next_run
        
        # Add site data if available
        if schedule.site_id and schedule.site_id in sites:
            site = sites[schedule.site_id]
            schedule_dict["site"] = {
                "id": site.id,
                "name": site.name,
                "url": site.url,
                "api_url": site.api_url,
                "username": site.username,
                "created_at": str(site.created_at)
            }
        
        # Add prompt template data if available
        if schedule.prompt_template_id and schedule.prompt_template_id in prompt_templates:
            prompt = prompt_templates[schedule.prompt_template_id]
            schedule_dict["prompt"] = {
                "id": prompt.id,
                "name": prompt.name,
                "description": prompt.description,
                "variables": prompt.variables,
                "system_prompt": prompt.system_prompt[:100] + "..." if prompt.system_prompt and len(prompt.system_prompt) > 100 else prompt.system_prompt
            }
        elif schedule.prompt_template_id:
            # Template ID exists but template not found
            schedule_dict["prompt"] = {
                "id": schedule.prompt_template_id,
                "name": "Template not found",
                "description": None,
                "variables": None,
                "system_prompt": None
            }
        else:
            # No template ID
            schedule_dict["prompt"] = None
        
        # Create a new namespace object with the modified data
        from types import SimpleNamespace
        processed_schedule = SimpleNamespace(**schedule_dict)
        processed_schedules.append(processed_schedule)
    
    return processed_schedules

@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog post schedule."""
    try:
        # Use a JOIN to fetch the site name and prompt template in a single query
        stmt = select(
            BlogSchedule,
            WordPressSite,
            PromptTemplate
        ).join(
            WordPressSite, 
            BlogSchedule.site_id == WordPressSite.id,
            isouter=True
        ).join(
            PromptTemplate,
            BlogSchedule.prompt_template_id == PromptTemplate.id,
            isouter=True
        ).where(
            (BlogSchedule.id == schedule_id) &
            (BlogSchedule.user_id == current_user.id)
        )
        
        result = await db.execute(stmt)
        row = result.first()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found"
            )
        
        # Extract entities from the row tuple
        schedule = row[0]
        site = row[1]
        prompt_template = row[2]
        
        # Use our safe serialization method
        from ..schemas.schedule import ScheduleResponse
        response = ScheduleResponse.from_orm_safe(schedule)
        
        # Debug logging for next_run values
        print(f"DEBUG - Schedule ID: {schedule.id}")
        print(f"DEBUG - Raw next_run: {schedule.next_run}")
        print(f"DEBUG - Response next_run: {response.next_run}")
        print(f"DEBUG - Response next_run_at: {response.next_run_at}")
        
        # Manually set the site as a dictionary from our join
        if site:
            response.site = {
                "id": site.id,
                "name": site.name,
                "url": getattr(site, "url", ""),
                "api_url": getattr(site, "api_url", ""),
                "username": getattr(site, "username", ""),
                "created_at": str(site.created_at) if site.created_at else None
            }
            
        # Manually set the prompt_template as a dictionary from our join
        if prompt_template:
            response.prompt = {
                "id": prompt_template.id,
                "name": prompt_template.name,
                "description": getattr(prompt_template, "description", ""),
                "variables": getattr(prompt_template, "variables", [])
            }
            # For backward compatibility, also set prompt_template
            response.prompt_template = response.prompt
            
        return response
    except Exception as e:
        print(f"Error in get_schedule: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.patch("/{schedule_id}/activate", response_model=ScheduleResponse)
async def activate_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a blog post schedule."""
    try:
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
        
        # Calculate next run time first to ensure we can compute it
        scheduler_service_local = SchedulerService()
        next_run = scheduler_service_local._calculate_next_run(schedule)
        
        # Update the schedule
        schedule.is_active = True
        schedule.next_run = next_run  # Set next_run directly on the model
        
        # Commit changes
        await db.commit()
        await db.refresh(schedule)
        
        # Schedule in the scheduler service (but don't rely on this for setting next_run)
        try:
            await scheduler_service.schedule_post(db, schedule.id)
        except Exception as scheduler_error:
            # Log the error but don't fail the activation
            print(f"Warning: Failed to schedule in scheduler service: {str(scheduler_error)}")
            # The next_run field is still set correctly in the database
        
        # Use our safe serialization method
        from ..schemas.schedule import ScheduleResponse
        response = ScheduleResponse.from_orm_safe(schedule)
        
        return response
        
    except ValueError as e:
        # Handle calculation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to calculate next run time: {str(e)}"
        )
    except Exception as e:
        # Log any unexpected errors
        print(f"Error activating schedule: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.patch("/{schedule_id}/deactivate", response_model=ScheduleResponse)
async def deactivate_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivate a blog post schedule."""
    try:
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
        
        # Update schedule
        schedule.is_active = False
        # Don't clear next_run - keep it for reference
        
        await db.commit()
        await db.refresh(schedule)
        
        # Remove any scheduled jobs using the safe method
        try:
            job_id = f"schedule_{schedule.id}_"
            safe_remove_job(scheduler_service.scheduler, job_id)
        except Exception as e:
            print(f"Error removing scheduled job: {str(e)}")
            # Non-critical error, continue
        
        # Use our safe serialization method
        from ..schemas.schedule import ScheduleResponse
        return ScheduleResponse.from_orm_safe(schedule)
    except Exception as e:
        # Log any unexpected errors
        print(f"Error deactivating schedule: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/{schedule_id}/run-now", response_model=ScheduleResponse)
async def run_schedule_now(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run a schedule immediately."""
    print(f"DEBUG API: Running schedule {schedule_id} now")
    
    # Debug user info
    print(f"DEBUG API: Current user ID: {current_user.id}")
    
    stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    print(f"DEBUG API: Executing query to find schedule")
    result = await db.execute(stmt)
    schedule = result.scalars().first()
    
    if not schedule:
        print(f"DEBUG API: Schedule {schedule_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    else:
        print(f"DEBUG API: Found schedule: {schedule.id}, active: {schedule.is_active}, site_id: {schedule.site_id}, prompt_id: {schedule.prompt_template_id}")
    
    # Check if schedule is inactive
    if not schedule.is_active:
        print(f"DEBUG API: Schedule {schedule_id} is inactive")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot run inactive schedule"
        )
    
    # Create execution history entry directly in the API endpoint
    execution_history = ExecutionHistory(
        schedule_id=schedule_id,
        user_id=current_user.id,
        execution_type="manual",
        success=False,  # Will be updated by the scheduler if successful
        error_message=None
    )
    db.add(execution_history)
    await db.commit()
    await db.refresh(execution_history)
    print(f"DEBUG API: Created execution history entry with ID {execution_history.id}")
        
    # Run the schedule's job immediately using the service method
    print(f"DEBUG API: Calling scheduler service run_now for schedule {schedule_id}")
    try:
        # Call scheduler service with timeout protection
        import asyncio
        try:
            # Set a reasonable timeout for the entire operation
            SCHEDULE_RUN_TIMEOUT = 75  # 75 seconds timeout (less than frontend timeout)
            await asyncio.wait_for(
                scheduler_service.run_now(db, schedule.id, execution_history.id),
                timeout=SCHEDULE_RUN_TIMEOUT
            )
            print(f"DEBUG API: Scheduler service run_now completed for schedule {schedule_id}")
            
            # Mark as successful directly in the API
            execution_history.success = True
            await db.commit()
            print(f"DEBUG API: Marked execution history {execution_history.id} as successful")
        except asyncio.TimeoutError:
            error_message = f"Schedule execution timed out after {SCHEDULE_RUN_TIMEOUT} seconds. The content generation process may still be running in the background."
            print(f"DEBUG API ERROR: {error_message}")
            
            # Update execution history with timeout error
            execution_history.error_message = error_message
            await db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=error_message
            )
    except asyncio.TimeoutError:
        # This is handled in the inner try/except block
        pass
    except Exception as e:
        print(f"DEBUG API ERROR: Run-now failed: {str(e)}")
        print(f"DEBUG API ERROR: Error type: {type(e)}")
        import traceback
        print(f"DEBUG API ERROR: Traceback: {traceback.format_exc()}")
        
        # Update execution history with error
        execution_history.error_message = f"Failed to run schedule: {str(e)}"
        await db.commit()
        
        # Provide more specific error messages based on the exception type
        if "MissingGreenlet" in str(e):
            detail = "Database connection error: SQLAlchemy async context issue. Please try again."
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        elif "timeout" in str(e).lower():
            detail = "Request timed out. The content generation process may still be running in the background."
            status_code = status.HTTP_504_GATEWAY_TIMEOUT
        elif "openai" in str(e).lower() and "api" in str(e).lower():
            detail = f"OpenAI API error: {str(e)}"
            status_code = status.HTTP_502_BAD_GATEWAY
        else:
            detail = f"Failed to run schedule: {str(e)}"
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        
        raise HTTPException(
            status_code=status_code,
            detail=detail
        )
    
    # Create a dictionary to hold our processed schedule data
    schedule_dict = schedule.__dict__.copy()
    
    # Add next_run_at field that the frontend expects, mirroring next_run
    if "next_run" in schedule_dict:
        next_run = schedule_dict["next_run"]
        if next_run and hasattr(next_run, "isoformat"):
            # Use ISO format for datetime objects to ensure proper JavaScript parsing
            schedule_dict["next_run_at"] = next_run.isoformat()
        else:
            # Otherwise just copy the value
            schedule_dict["next_run_at"] = next_run
    
    # Add site data in a serializable format
    if schedule.site_id:
        site_stmt = select(WordPressSite).where(WordPressSite.id == schedule.site_id)
        site_result = await db.execute(site_stmt)
        site = site_result.scalars().first()
        
        if site:
            schedule_dict["site"] = {
                "id": site.id,
                "name": site.name,
                "url": site.url,
                "api_url": site.api_url,
                "username": site.username,
                "created_at": str(site.created_at)
            }
    
    # Add prompt template data in a serializable format
    if schedule.prompt_template_id:
        prompt_stmt = select(PromptTemplate).where(PromptTemplate.id == schedule.prompt_template_id)
        prompt_result = await db.execute(prompt_stmt)
        prompt = prompt_result.scalars().first()
        
        if prompt:
            schedule_dict["prompt"] = {
                "id": prompt.id,
                "name": prompt.name,
                "description": prompt.description,
                "variables": prompt.variables
            }
    
    # Create a new schedule object with the site and prompt data included
    from types import SimpleNamespace
    processed_schedule = SimpleNamespace(**schedule_dict)
    
    return processed_schedule

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
    except Exception as e:
        print(f"Error removing scheduled job: {str(e)}")
    
    try:
        # First delete all related execution history records
        delete_history_stmt = delete(ExecutionHistory).where(ExecutionHistory.schedule_id == schedule_id)
        await db.execute(delete_history_stmt)
        
        # Delete any related blog posts
        delete_posts_stmt = delete(BlogPost).where(BlogPost.schedule_id == schedule_id)
        await db.execute(delete_posts_stmt)
        
        # Now delete the schedule
        await db.delete(schedule)
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Error deleting schedule: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete schedule: {str(e)}"
        )

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing blog post schedule."""
    # Find the schedule
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
    
    # Update schedule fields
    schedule.name = schedule_data.name
    schedule.site_id = schedule_data.site_id
    schedule.prompt_template_id = schedule_data.prompt_template_id
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
    
    # Re-schedule the next run
    await scheduler_service.schedule_post(db, schedule.id)
    
    # Create a dictionary to hold our processed schedule data
    schedule_dict = schedule.__dict__.copy()
    
    # Add next_run_at field that the frontend expects, mirroring next_run
    if "next_run" in schedule_dict:
        next_run = schedule_dict["next_run"]
        if next_run and hasattr(next_run, "isoformat"):
            # Use ISO format for datetime objects to ensure proper JavaScript parsing
            schedule_dict["next_run_at"] = next_run.isoformat()
        else:
            # Otherwise just copy the value
            schedule_dict["next_run_at"] = next_run
    
    # Add site data in a serializable format
    if schedule.site_id:
        site_stmt = select(WordPressSite).where(WordPressSite.id == schedule.site_id)
        site_result = await db.execute(site_stmt)
        site = site_result.scalars().first()
        
        if site:
            schedule_dict["site"] = {
                "id": site.id,
                "name": site.name,
                "url": site.url,
                "api_url": site.api_url,
                "username": site.username,
                "created_at": str(site.created_at)
            }
    
    # Add prompt template data in a serializable format
    if schedule.prompt_template_id:
        prompt_stmt = select(PromptTemplate).where(PromptTemplate.id == schedule.prompt_template_id)
        prompt_result = await db.execute(prompt_stmt)
        prompt = prompt_result.scalars().first()
        
        if prompt:
            schedule_dict["prompt"] = {
                "id": prompt.id,
                "name": prompt.name,
                "description": prompt.description,
                "variables": prompt.variables
            }
    
    # Create a new schedule object with the site and prompt data included
    from types import SimpleNamespace
    processed_schedule = SimpleNamespace(**schedule_dict)
    
    return processed_schedule

@router.get("/{schedule_id}/execution-history", response_model=List[ExecutionHistoryResponse])
async def get_execution_history(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 10,
    offset: int = 0
):
    """Get execution history for a schedule."""
    # First, verify the schedule exists and belongs to the user
    schedule_stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    schedule_result = await db.execute(schedule_stmt)
    schedule = schedule_result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
    
    # Get the execution history for this schedule
    stmt = select(ExecutionHistory).where(
        (ExecutionHistory.schedule_id == schedule_id) &
        (ExecutionHistory.user_id == current_user.id)
    ).order_by(ExecutionHistory.execution_time.desc()).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    history_items = result.scalars().all()
    
    return list(history_items)

@router.post("/{schedule_id}/record-execution", response_model=ExecutionHistoryResponse)
async def record_schedule_execution(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually record a schedule execution for testing purposes."""
    # Verify the schedule exists and belongs to the user
    schedule_stmt = select(BlogSchedule).where(
        (BlogSchedule.id == schedule_id) &
        (BlogSchedule.user_id == current_user.id)
    )
    schedule_result = await db.execute(schedule_stmt)
    schedule = schedule_result.scalars().first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found"
        )
        
    # Create a new execution history entry
    execution_entry = ExecutionHistory(
        schedule_id=schedule_id,
        user_id=current_user.id,
        execution_type="manual",
        success=True,
        error_message=None
    )
    
    db.add(execution_entry)
    await db.commit()
    await db.refresh(execution_entry)
    
    return execution_entry

@router.get("/{schedule_id}/debug", tags=["debug"])
async def get_schedule_debug(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint to get a specific blog post schedule without authentication."""
    try:
        # Use a JOIN to fetch the site name and prompt template in a single query
        stmt = select(
            BlogSchedule,
            WordPressSite,
            PromptTemplate
        ).join(
            WordPressSite, 
            BlogSchedule.site_id == WordPressSite.id,
            isouter=True
        ).join(
            PromptTemplate,
            BlogSchedule.prompt_template_id == PromptTemplate.id,
            isouter=True
        ).where(
            BlogSchedule.id == schedule_id
        )
        
        result = await db.execute(stmt)
        row = result.first()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found"
            )
        
        # Extract entities from the row tuple
        schedule = row[0]
        site = row[1]
        prompt_template = row[2]
        
        # Use our safe serialization method
        from ..schemas.schedule import ScheduleResponse
        response = ScheduleResponse.from_orm_safe(schedule)
        
        # Debug logging for next_run values
        print(f"DEBUG - Schedule ID: {schedule.id}")
        print(f"DEBUG - Raw next_run: {schedule.next_run}")
        print(f"DEBUG - Response next_run: {response.next_run}")
        print(f"DEBUG - Response next_run_at: {response.next_run_at}")
        print(f"DEBUG - Schedule is_active: {schedule.is_active}")
        
        # Check if next_run is timezone-aware
        if schedule.next_run and hasattr(schedule.next_run, 'tzinfo'):
            print(f"DEBUG - next_run tzinfo: {schedule.next_run.tzinfo}")
        
        # Manually set the site as a dictionary from our join
        if site:
            response.site = {
                "id": site.id,
                "name": site.name,
                "url": getattr(site, "url", ""),
                "api_url": getattr(site, "api_url", ""),
                "username": getattr(site, "username", ""),
                "created_at": str(site.created_at) if site.created_at else None
            }
            
        # Manually set the prompt_template as a dictionary from our join
        if prompt_template:
            response.prompt = {
                "id": prompt_template.id,
                "name": prompt_template.name,
                "description": getattr(prompt_template, "description", ""),
                "variables": getattr(prompt_template, "variables", [])
            }
            # For backward compatibility, also set prompt_template
            response.prompt_template = response.prompt
            
        return {
            "id": response.id,
            "name": response.name,
            "frequency": response.frequency,
            "time_of_day": response.time_of_day,
            "is_active": response.is_active,
            "next_run": str(response.next_run) if response.next_run else None,
            "next_run_at": response.next_run_at,
            "site": response.site,
            "prompt": response.prompt,
            "prompt_template": response.prompt_template
        }
    except Exception as e:
        print(f"Error in get_schedule_debug: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/{schedule_id}/raw", tags=["debug"])
async def get_raw_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Debug endpoint to get raw schedule data from the database."""
    try:
        # Direct query to get raw schedule data
        stmt = select(BlogSchedule).where(
            BlogSchedule.id == schedule_id
        )
        
        result = await db.execute(stmt)
        schedule = result.scalars().first()
        
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found"
            )
        
        # Get raw data as a dictionary
        schedule_dict = {
            "id": schedule.id,
            "name": schedule.name,
            "frequency": schedule.frequency,
            "time_of_day": schedule.time_of_day,
            "is_active": schedule.is_active,
            "next_run": None,
            "next_run_type": None,
            "next_run_str": None,
            "next_run_tzinfo": None
        }
        
        # Add raw next_run value information
        if schedule.next_run:
            schedule_dict["next_run"] = str(schedule.next_run)
            schedule_dict["next_run_type"] = str(type(schedule.next_run))
            schedule_dict["next_run_str"] = schedule.next_run.isoformat() if hasattr(schedule.next_run, "isoformat") else str(schedule.next_run)
            schedule_dict["next_run_tzinfo"] = str(schedule.next_run.tzinfo) if hasattr(schedule.next_run, "tzinfo") else "None"
            
        return schedule_dict
        
    except Exception as e:
        print(f"Error in get_raw_schedule: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )