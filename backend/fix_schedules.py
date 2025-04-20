import asyncio
from datetime import datetime
from sqlalchemy.future import select
from sqlalchemy import update
from app.core.database import async_session_factory
from app.models.blog_schedule import BlogSchedule
from app.services.scheduler import SchedulerService

async def fix_all_schedules():
    """Find and fix all schedules with missing or incorrect next_run values."""
    print("Starting schedule fix script...")
    
    async with async_session_factory() as db:
        # Get all active schedules
        stmt = select(BlogSchedule).where(BlogSchedule.is_active == True)
        result = await db.execute(stmt)
        schedules = result.scalars().all()
        
        if not schedules:
            print("No active schedules found")
            return
        
        print(f"Found {len(schedules)} active schedules")
        
        # Create scheduler service for next_run calculation
        scheduler = SchedulerService()
        
        # Check and fix each schedule
        fixed_count = 0
        for schedule in schedules:
            print(f"\nExamining schedule #{schedule.id}: {schedule.name}")
            print(f"  Frequency: {schedule.frequency}")
            print(f"  Time of day: {schedule.time_of_day}")
            print(f"  Current next_run: {schedule.next_run}")
            
            # Skip if time_of_day is missing
            if not schedule.time_of_day:
                print(f"  Error: Schedule #{schedule.id} is missing time_of_day, skipping")
                continue
                
            # Calculate what next_run should be
            try:
                calculated_next_run = scheduler._calculate_next_run(schedule)
                print(f"  Calculated next_run: {calculated_next_run}")
                
                # Update if missing or different
                if schedule.next_run is None or abs((schedule.next_run - calculated_next_run).total_seconds()) > 60:
                    print(f"  Fixing next_run for schedule #{schedule.id}")
                    
                    await db.execute(
                        update(BlogSchedule)
                        .where(BlogSchedule.id == schedule.id)
                        .values(next_run=calculated_next_run)
                    )
                    
                    fixed_count += 1
                else:
                    print(f"  Schedule #{schedule.id} next_run is already correct")
            except Exception as e:
                print(f"  Error calculating next_run for schedule #{schedule.id}: {str(e)}")
        
        # Commit all changes
        if fixed_count > 0:
            await db.commit()
            print(f"\nFixed {fixed_count} schedules")
        else:
            print("\nNo schedules needed fixing")

if __name__ == "__main__":
    # Run the async function
    asyncio.run(fix_all_schedules()) 