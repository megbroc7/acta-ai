import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
import os

from ..models.blog_schedule import BlogSchedule, BlogPost
from ..models.site import WordPressSite
from ..models.prompt_template import PromptTemplate
from .wordpress import WordPressService
from .content import ContentGenerator

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        
        # Only start the scheduler if not in testing mode
        if os.environ.get("TESTING") != "True":
            try:
                self.scheduler.start()
            except RuntimeError:
                # Handle case where there's no running event loop
                logger.warning("No running event loop, scheduler not started")
        
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
                    args=[db, schedule.id],
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
                    
            elif schedule.frequency == "weekly" and schedule.day_of_week is not None:
                days_ahead = schedule.day_of_week - now.weekday()
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=days_ahead)
                
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
    
    async def _generate_and_post(self, db: AsyncSession, schedule_id: int):
        """Generate and post a blog post based on schedule settings."""
        try:
            # Get a new session to avoid expired session
            async with AsyncSession(db.bind) as new_db:
                # Get schedule
                stmt = select(BlogSchedule).where(BlogSchedule.id == schedule_id)
                result = await new_db.execute(stmt)
                schedule = result.scalars().first()
                
                if not schedule or not schedule.is_active:
                    logger.warning(f"Schedule {schedule_id} not found or inactive")
                    return
                
                # Get WordPress site
                stmt = select(WordPressSite).where(WordPressSite.id == schedule.site_id)
                result = await new_db.execute(stmt)
                site = result.scalars().first()
                
                if not site or not site.is_active:
                    logger.warning(f"WordPress site {schedule.site_id} not found or inactive")
                    return
                
                # Get prompt template
                stmt = select(PromptTemplate).where(PromptTemplate.id == schedule.prompt_template_id)
                result = await new_db.execute(stmt)
                prompt_template = result.scalars().first()
                
                if not prompt_template:
                    logger.warning(f"Prompt template {schedule.prompt_template_id} not found")
                    return
                
                # Initialize services
                content_generator = ContentGenerator()
                wp_service = WordPressService(
                    api_url=site.api_url,
                    username=site.username,
                    app_password=site.app_password
                )
                
                # Generate content
                idea = content_generator.pick_random_idea(schedule.topics)
                topic, topic_prompt_used = await content_generator.generate_blog_topic(
                    idea=idea,
                    prompt_template=prompt_template,
                    custom_replacements=schedule.prompt_replacements
                )
                
                content, content_prompt_used = await content_generator.generate_blog_post(
                    topic=topic,
                    prompt_template=prompt_template,
                    custom_replacements={
                        **schedule.prompt_replacements,
                        "word_count": schedule.word_count,
                        "tone": schedule.tone
                    }
                )
                
                formatted_content = content_generator.format_content_for_wordpress(content)
                excerpt = content_generator.extract_excerpt(content)
                
                # Create WordPress post
                post_data = {
                    "title": topic,
                    "content": formatted_content,
                    "status": schedule.post_status,
                    "categories": schedule.category_ids,
                    "tags": schedule.tag_ids,
                    "excerpt": excerpt
                }
                
                # Post to WordPress
                result = await wp_service.create_post(post_data)
                
                # Save post to database
                if result.get("success"):
                    new_post = BlogPost(
                        schedule_id=schedule.id,
                        user_id=schedule.user_id,
                        site_id=site.id,
                        prompt_template_id=prompt_template.id,
                        wordpress_id=result["data"]["id"],
                        wordpress_url=result["data"].get("link"),
                        title=topic,
                        content=formatted_content,
                        excerpt=excerpt,
                        categories=schedule.category_ids,
                        tags=schedule.tag_ids,
                        status="published" if schedule.post_status == "publish" else "draft",
                        system_prompt_used=prompt_template.system_prompt,
                        topic_prompt_used=topic_prompt_used,
                        content_prompt_used=content_prompt_used,
                        published_at=datetime.now() if schedule.post_status == "publish" else None
                    )
                    new_db.add(new_post)
                    
                    # Update schedule last_run
                    await new_db.execute(
                        update(BlogSchedule)
                        .where(BlogSchedule.id == schedule.id)
                        .values(last_run=datetime.now())
                    )
                    
                    await new_db.commit()
                    
                    # Schedule next run
                    await self.schedule_post(new_db, schedule.id)
                else:
                    logger.error(f"Failed to post to WordPress: {result.get('error')}")
                    
        except Exception as e:
            logger.error(f"Error generating and posting blog: {str(e)}")
            # Re-schedule for retry later
            self.scheduler.add_job(
                self._generate_and_post,
                trigger=DateTrigger(run_date=datetime.now() + timedelta(hours=1)),
                args=[db, schedule_id],
                id=f"retry_schedule_{schedule_id}_{datetime.now().isoformat()}",
                replace_existing=True
            ) 