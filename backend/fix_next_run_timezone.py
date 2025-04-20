import asyncio
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy import update
from app.core.database import async_session_factory
from app.models.blog_schedule import BlogSchedule
from app.services.scheduler import SchedulerService

async def fix_next_run_timezone():
    """Fix the next_run timezone issue in active schedules."""
    print("Fixing next_run timezone issues...")
    
    async with async_session_factory() as db:
        # Get all active schedules
        stmt = select(BlogSchedule).where(BlogSchedule.is_active == True)
        result = await db.execute(stmt)
        schedules = result.scalars().all()
        
        if not schedules:
            print("No active schedules found!")
            return
            
        scheduler = SchedulerService()
        fixed_count = 0
        
        for schedule in schedules:
            print(f"\nChecking schedule {schedule.id}: {schedule.name}")
            print(f"  Current next_run: {schedule.next_run}")
            
            # Calculate the next run time properly
            calculated_next_run = scheduler._calculate_next_run(schedule)
            
            # Convert to proper ISO format that JS will parse correctly
            if calculated_next_run:
                # Make sure we're working with a timezone-aware datetime
                # and convert to proper ISO format string
                if calculated_next_run.tzinfo is None:
                    # If it's naive, assume it's UTC
                    calculated_next_run = calculated_next_run.replace(tzinfo=timezone.utc)
                
                print(f"  Calculated next_run: {calculated_next_run}")
                print(f"  ISO format: {calculated_next_run.isoformat()}")
                
                # Update the database
                await db.execute(
                    update(BlogSchedule)
                    .where(BlogSchedule.id == schedule.id)
                    .values(next_run=calculated_next_run)
                )
                fixed_count += 1
        
        if fixed_count > 0:
            await db.commit()
            print(f"\nFixed {fixed_count} schedules")
        else:
            print("\nNo schedules needed fixing")

if __name__ == "__main__":
    asyncio.run(fix_next_run_timezone()) 