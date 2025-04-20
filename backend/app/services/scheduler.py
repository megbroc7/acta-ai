import logging
import os
import asyncio
import pytz
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, or_, and_
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
import re
from ..models.blog_schedule import BlogSchedule, BlogPost
from ..models.site import WordPressSite
from ..models.prompt_template import PromptTemplate
from .wordpress import WordPressService
from .content import ContentGenerator
from ..models import ExecutionHistory, User
from ..core.database import engine, async_session_factory


logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        # We'll start the scheduler in start_scheduler method now
        # Not starting automatically in __init__ anymore
    
    async def init_scheduler(self):
        """Initialize the scheduler service.
        This method is called during application startup from main.py.
        """
        logger.info("Initializing scheduler service")
        # Nothing to initialize specifically, but keeping the method
        # to match the expected interface in main.py
        return True
        
    async def start_scheduler(self):
        """Start the scheduler."""
        # Only start the scheduler if not in testing mode and not already running
        if os.environ.get("TESTING") != "True" and not self.scheduler.running:
            try:
                print("Starting scheduler with configuration:")
                print(f"  - Scheduler type: {type(self.scheduler)}")
                print(f"  - Job stores: {self.scheduler._jobstores}")
                print(f"  - Executors: {self.scheduler._executors}")
                
                logger.info("Starting scheduler")
                self.scheduler.start()
                
                # Add debug job to verify scheduler is working
                self.scheduler.add_job(
                    self._debug_test_job,
                    trigger='date',
                    run_date=datetime.now() + timedelta(seconds=10),
                    id='debug_test_job',
                    replace_existing=True
                )
                print("Added debug test job to verify scheduler is working")
                
                return True
            except RuntimeError as e:
                # Handle case where there's no running event loop
                logger.warning(f"No running event loop, scheduler not started: {str(e)}")
                print(f"ERROR: No running event loop, scheduler not started: {str(e)}")
                return False
            except Exception as e:
                logger.error(f"Failed to start scheduler: {str(e)}")
                print(f"ERROR: Failed to start scheduler: {str(e)}")
                import traceback
                print(f"Scheduler start error: {traceback.format_exc()}")
                return False
    
    # Debug method to test if scheduler is running jobs
    async def _debug_test_job(self):
        """Debug test job to verify scheduler is working."""
        print("DEBUG TEST JOB EXECUTED - Scheduler is working!")
        logger.info("DEBUG TEST JOB EXECUTED - Scheduler is working!")
        
    async def schedule_post(self, db: AsyncSession, schedule_id: int):
        """Schedule a post based on BlogSchedule settings."""
        # Get schedule from DB
        stmt = select(BlogSchedule).where(BlogSchedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalars().first()
        
        if not schedule or not schedule.is_active:
            logger.warning(f"Schedule {schedule_id} not found or inactive")
            return False
        
        # Get WordPress site
        stmt = select(WordPressSite).where(WordPressSite.id == schedule.site_id)
        result = await db.execute(stmt)
        site = result.scalars().first()
        
        if not site or not site.is_active:
            logger.warning(f"WordPress site {schedule.site_id} not found or inactive")
            return False
        
        # Calculate next run
        next_run = self._calculate_next_run(schedule)
        
        # Add job to scheduler (skip in testing mode)
        if os.environ.get("TESTING") != "True":
            try:
                self.scheduler.add_job(
                    self._generate_and_post,
                    trigger=DateTrigger(run_date=next_run),
                    args=[schedule.id],
                    id=f"schedule_{schedule.id}_{next_run.isoformat()}",
                    replace_existing=True
                )
            except RuntimeError:
                logger.warning("Could not add job to scheduler - no running event loop")
        
        # Update next_run in database
        await db.execute(
            update(BlogSchedule)
            .where(BlogSchedule.id == schedule.id)
            .values(next_run=next_run)
        )
        await db.commit()
        
        return True
            
    def _calculate_next_run(self, schedule: BlogSchedule) -> datetime:
        """Calculate the next run time based on schedule settings."""
        now = datetime.now()
        
        if schedule.frequency == "custom" and schedule.custom_cron:
            # Use custom cron expression
            trigger = CronTrigger.from_crontab(schedule.custom_cron)
            next_run = trigger.get_next_fire_time(None, now)
        else:
            # Parse time of day
            hour, minute = map(int, schedule.time_of_day.split(':'))
            
            if schedule.frequency == "daily":
                next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if next_run <= now:
                    next_run += timedelta(days=1)
                    
            elif schedule.frequency == "weekly":
                # Only use day_of_week (single day selection)
                if schedule.day_of_week is not None:
                    # Single day of week scheduling
                    target_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    
                    # Calculate days until target day
                    days_until = schedule.day_of_week - now.weekday()
                    if days_until <= 0:  # Target day already happened this week
                        days_until += 7
                    
                    next_run = target_time + timedelta(days=days_until)
                else:
                    # Default to Monday if no day is set
                    target_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    days_until = 0 - now.weekday()  # Monday is 0
                    if days_until <= 0:
                        days_until += 7
                    next_run = target_time + timedelta(days=days_until)
                
            elif schedule.frequency == "monthly" and schedule.day_of_month is not None:
                next_run = now.replace(day=min(schedule.day_of_month, 28), hour=hour, minute=minute, second=0, microsecond=0)
                if next_run <= now:
                    # Get next month, handling December -> January transition
                    if now.month == 12:
                        next_run = next_run.replace(year=now.year + 1, month=1)
                    else:
                        next_run = next_run.replace(month=now.month + 1)
            else:
                # Default to tomorrow at specified time
                next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=1)
        
        return next_run
    
    async def _generate_and_post(self, schedule_id: int):
        """Generate and post a blog post based on schedule settings."""
        print(f"DEBUG: _generate_and_post started for schedule {schedule_id}")
        
        # Track session and execution history entry for cleanup
        new_db = None
        read_db = None  # Separate session for read operations
        execution_history_entry = None
        existing_history_id = None
        
        # Check if we're using an existing execution history entry
        if hasattr(self, "execution_history_id"):
            existing_history_id = getattr(self, "execution_history_id")
            print(f"DEBUG: Using existing execution history ID: {existing_history_id}")
        
        # Default values for content
        title = ""
        content = ""
        excerpt = ""
        
        # For error tracking
        content_error = None
        generation_completed = False
        
        try:
            # Create a read-only session using the factory
            read_db = async_session_factory()
            
            # Get the schedule
            stmt = select(BlogSchedule).where(BlogSchedule.id == schedule_id)
            result = await read_db.execute(stmt)
            schedule = result.scalars().first()
            
            if not schedule:
                print(f"DEBUG ERROR: Schedule {schedule_id} not found")
                return
            
            print(f"DEBUG: Found schedule: {schedule.id}, Name: {schedule.name}")
            
            # Phase 1: Generate content outside of main transaction
            try:
                # Retrieve prompt template
                prompt_template_stmt = select(PromptTemplate).where(PromptTemplate.id == schedule.prompt_template_id)
                prompt_template_result = await read_db.execute(prompt_template_stmt)
                prompt_template = prompt_template_result.scalars().first()
                
                if prompt_template:
                    print(f"DEBUG: Found prompt template: {prompt_template.name}")
                    
                    # Initialize content generator
                    content_generator = ContentGenerator()
                    
                    # Phase 1.1: Content generation with timeout protection
                    try:
                        # Pick a topic from the schedule's topics list
                        idea = content_generator.pick_random_idea(schedule.topics or [])
                        print(f"DEBUG: Selected topic idea: {idea}")
                        
                        # Generate the blog topic with timeout protection
                        import asyncio
                        TOPIC_GENERATION_TIMEOUT = 30  # 30 seconds timeout for topic generation
                        try:
                            topic, topic_prompt = await asyncio.wait_for(
                                content_generator.generate_blog_topic(
                                    idea=idea,
                                    prompt_template=prompt_template,
                                    custom_replacements=schedule.prompt_replacements
                                ),
                                timeout=TOPIC_GENERATION_TIMEOUT
                            )
                            print(f"DEBUG: Generated topic: {topic}")
                        except asyncio.TimeoutError:
                            print(f"DEBUG ERROR: Topic generation timed out after {TOPIC_GENERATION_TIMEOUT} seconds")
                            raise Exception(f"Topic generation timed out after {TOPIC_GENERATION_TIMEOUT} seconds")
                        
                        # Then generate the full content with timeout protection
                        replacements = {
                            "tone": schedule.tone or prompt_template.default_tone,
                            "word_count": schedule.word_count or prompt_template.default_word_count
                        }
                        if schedule.prompt_replacements:
                            replacements.update(schedule.prompt_replacements)
                        
                        CONTENT_GENERATION_TIMEOUT = 60  # 60 seconds timeout for content generation
                        try:
                            content_text, content_prompt = await asyncio.wait_for(
                                content_generator.generate_blog_post(
                                    topic=topic,
                                    prompt_template=prompt_template,
                                    custom_replacements=replacements
                                ),
                                timeout=CONTENT_GENERATION_TIMEOUT
                            )
                            print(f"DEBUG: Generated content of length: {len(content_text)}")
                        except asyncio.TimeoutError:
                            print(f"DEBUG ERROR: Content generation timed out after {CONTENT_GENERATION_TIMEOUT} seconds")
                            raise Exception(f"Content generation timed out after {CONTENT_GENERATION_TIMEOUT} seconds")
                        
                        # Format content and extract excerpt
                        content = content_generator.format_content_for_wordpress(content_text)
                        excerpt = content_generator.extract_excerpt(content_text)
                        
                        # Use the generated topic as the title
                        title = topic
                        
                        # Clean up the title to ensure consistent formatting
                        # Remove any quotes at beginning and end
                        title = title.strip('"\'')
                        # Remove Markdown heading symbols (# followed by space) from the beginning of titles
                        title = re.sub(r'^#+\s+', '', title)
                        # Normalize spacing (replace multiple spaces with a single space)
                        title = re.sub(r'\s+', ' ', title)
                        print(f"DEBUG: Cleaned title for consistency: {title}")
                        
                        generation_completed = True
                        
                    except Exception as e:
                        print(f"DEBUG ERROR: Detailed content generation error - {str(e)}")
                        content_error = str(e)
                        # Let the outer catch block handle the fallback
                        raise
                else:
                    print(f"DEBUG ERROR: Prompt template {schedule.prompt_template_id} not found")
                    content_error = f"Prompt template {schedule.prompt_template_id} not found"
                    raise Exception(f"Prompt template {schedule.prompt_template_id} not found")
                    
            except Exception as e:
                print(f"DEBUG ERROR: Content generation failed - {str(e)}")
                # Detailed error for fallback content
                content_error = str(e)
                # We'll handle fallback in the next phase
            
            # Phase 2: Database transaction for record creation
            # Use the session factory for the new session as well
            new_db = async_session_factory()
            
            # Get or create execution history entry
            if existing_history_id:
                # Get the existing entry
                history_stmt = select(ExecutionHistory).where(ExecutionHistory.id == existing_history_id)
                history_result = await new_db.execute(history_stmt)
                execution_history_entry = history_result.scalars().first()
                if execution_history_entry:
                    print(f"DEBUG: Found existing execution history entry: {execution_history_entry.id}")
                else:
                    print(f"DEBUG ERROR: Could not find execution history entry with ID {existing_history_id}")
                    # Create a new one as fallback
                    execution_history_entry = ExecutionHistory(
                        schedule_id=schedule_id,
                        user_id=schedule.user_id,
                        execution_type="manual",
                        success=False,
                        error_message=None
                    )
                    new_db.add(execution_history_entry)
                    await new_db.commit()
                    print(f"DEBUG: Created new execution history entry as fallback: {execution_history_entry.id}")
            else:
                # Create a new execution history entry
                execution_history_entry = ExecutionHistory(
                    schedule_id=schedule_id,
                    user_id=schedule.user_id,
                    execution_type="scheduled" if not hasattr(self, "manual_run") else "manual",
                    success=False,
                    error_message=None
                )
                new_db.add(execution_history_entry)
                await new_db.commit()
                print(f"DEBUG: Created new execution history entry: {execution_history_entry.id}")
            
            # If generation failed, use fallback content
            if not generation_completed:
                print(f"DEBUG: Using fallback content due to generation failure")
                title = f"Generated Blog Post - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                # Ensure consistent formatting of fallback title
                title = title.strip('"\'')
                # Remove Markdown heading symbols (# followed by space) from the beginning of titles
                title = re.sub(r'^#+\s+', '', title)
                title = re.sub(r'\s+', ' ', title)
                content = f"This is a sample blog post. Content generation failed: {content_error or 'Unknown error'}"
                excerpt = "Error generating content."
            
            # Create the blog post with the required fields
            print(f"DEBUG: Creating blog post entry with {'generated' if generation_completed else 'fallback'} content")
            
            blog_post = BlogPost(
                schedule_id=schedule_id,
                user_id=schedule.user_id,
                site_id=schedule.site_id,
                prompt_template_id=schedule.prompt_template_id,
                title=title,
                content=content,
                excerpt=excerpt,
                status="draft",
                categories=schedule.category_ids if schedule.category_ids is not None else [],
                tags=schedule.tag_ids if schedule.tag_ids is not None else []
            )
            
            # Add and commit the blog post
            new_db.add(blog_post)
            await new_db.commit()
            await new_db.refresh(blog_post)
            print(f"DEBUG: Created blog post with ID {blog_post.id}")
            
            # Update execution history with blog post ID
            execution_history_entry.post_id = blog_post.id
            execution_history_entry.success = True
            execution_history_entry.error_message = None if generation_completed else f"Created with fallback content: {content_error}"
            await new_db.commit()
            print(f"DEBUG: Execution marked as successful with blog post ID {blog_post.id}")
        
        except Exception as e:
            error_message = f"Global error in _generate_and_post: {str(e)}"
            print(f"DEBUG CRITICAL ERROR: {error_message}")
            import traceback
            print(f"DEBUG TRACEBACK: {traceback.format_exc()}")
            
            # Update execution history with error if we have an entry
            if execution_history_entry and new_db:
                try:
                    execution_history_entry.success = False
                    execution_history_entry.error_message = error_message
                    await new_db.commit()
                    print(f"DEBUG: Updated execution history with error")
                except Exception as commit_error:
                    print(f"DEBUG ERROR: Failed to update execution history with error: {str(commit_error)}")
        
        finally:
            # Close the database sessions
            if read_db:
                try:
                    await read_db.close()
                    print(f"DEBUG: Closed read database session")
                except Exception as e:
                    print(f"DEBUG ERROR: Failed to close read database session: {str(e)}")
                
            if new_db:
                try:
                    await new_db.close()
                    print(f"DEBUG: Closed main database session")
                except Exception as e:
                    print(f"DEBUG ERROR: Failed to close main database session: {str(e)}")
                
        print(f"DEBUG: _generate_and_post completed for schedule {schedule_id}")
    
    # Update the run_schedule_now function to flag executions as manual
    async def run_now(self, db: AsyncSession, schedule_id: int, execution_history_id: int = None):
        """Run a schedule immediately (manually triggered)."""
        print(f"DEBUG: run_now called for schedule {schedule_id}")
        try:
            # Log more details
            print(f"DEBUG: Checking if schedule exists")
            stmt = select(BlogSchedule).where(BlogSchedule.id == schedule_id)
            result = await db.execute(stmt)
            schedule = result.scalars().first()
            
            if not schedule:
                print(f"DEBUG ERROR: Schedule {schedule_id} not found in run_now")
                return False
                
            print(f"DEBUG: Schedule found - ID: {schedule.id}, Name: {schedule.name}, Site ID: {schedule.site_id}, Prompt ID: {schedule.prompt_template_id}")
            
            # Add marker for manual execution
            print(f"DEBUG: Setting manual_run flag")
            setattr(self, "manual_run", True)
            
            # Store execution history ID if provided
            if execution_history_id:
                print(f"DEBUG: Using existing execution history ID {execution_history_id}")
                setattr(self, "execution_history_id", execution_history_id)
            
            # DIRECT EXECUTION: Call _generate_and_post directly instead of scheduling
            print(f"DEBUG: Executing _generate_and_post directly")
            await self._generate_and_post(schedule_id)
            print(f"DEBUG: Direct execution completed")
            
            # Also schedule the job as before (for consistent behavior/logs)
            job_id = f"manual_run_schedule_{schedule_id}_{datetime.now().isoformat()}"
            print(f"DEBUG: Also scheduling job with ID {job_id} (for consistency)")
            try:
                self.scheduler.add_job(
                    self._generate_and_post,
                    trigger='date',
                    run_date=datetime.now() + timedelta(seconds=5),
                    args=[schedule_id],  # Only pass schedule_id, not the db session
                    id=job_id,
                    replace_existing=True
                )
                print(f"DEBUG: Job scheduled successfully")
            except Exception as e:
                print(f"DEBUG ERROR: Failed to schedule job (non-critical): {str(e)}")
                # We don't raise here since we already executed the function directly
            
            return True
        except Exception as e:
            print(f"DEBUG ERROR: Unexpected error in run_now: {str(e)}")
            import traceback
            print(f"DEBUG ERROR: run_now traceback: {traceback.format_exc()}")
            raise
        finally:
            # Clean up marker after a short delay (to ensure the job has started)
            async def remove_marker():
                await asyncio.sleep(30)  # Wait 30 seconds before removing the marker
                print(f"DEBUG: Removing manual_run flag")
                if hasattr(self, "manual_run"):
                    delattr(self, "manual_run")
                if hasattr(self, "execution_history_id"):
                    delattr(self, "execution_history_id")
            
            # Start the cleanup process (don't wait for it)
            asyncio.create_task(remove_marker()) 