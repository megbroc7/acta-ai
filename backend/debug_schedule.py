import asyncio
import sys
from datetime import datetime
from sqlalchemy.future import select
from sqlalchemy import update
from app.core.database import async_session_factory
from app.models.blog_schedule import BlogSchedule
from app.services.scheduler import SchedulerService

async def diagnose_schedule(schedule_id: int):
    """Diagnose issues with next_run field for a specific schedule."""
    print(f"Diagnosing schedule #{schedule_id}...")
    
    async with async_session_factory() as db:
        # Get the schedule
        stmt = select(BlogSchedule).where(BlogSchedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalars().first()
        
        if not schedule:
            print(f"Schedule #{schedule_id} not found!")
            return
        
        # Print schedule state
        print("\nSchedule Details:")
        print(f"ID: {schedule.id}")
        print(f"Name: {schedule.name}")
        print(f"Frequency: {schedule.frequency}")
        print(f"Time of Day: {schedule.time_of_day}")
        print(f"Day of Week: {schedule.day_of_week}")
        print(f"Day of Month: {schedule.day_of_month}")
        print(f"Is Active: {schedule.is_active}")
        print(f"Next Run: {schedule.next_run}")
        
        # Check for field values that might affect next_run calculation
        issues = []
        if not schedule.time_of_day:
            issues.append("Missing time_of_day field")
        if schedule.frequency == "weekly" and schedule.day_of_week is None:
            issues.append("Missing day_of_week for weekly schedule")
        if schedule.frequency == "monthly" and schedule.day_of_month is None:
            issues.append("Missing day_of_month for monthly schedule")
        
        if issues:
            print("\nPotential Issues:")
            for issue in issues:
                print(f"- {issue}")
        
        # Calculate what next_run should be
        scheduler = SchedulerService()
        calculated_next_run = scheduler._calculate_next_run(schedule)
        print(f"\nCalculated Next Run: {calculated_next_run}")
        
        # Check if we need to update next_run
        if schedule.is_active and (schedule.next_run is None or schedule.next_run != calculated_next_run):
            print("\nFixing next_run field...")
            await db.execute(
                update(BlogSchedule)
                .where(BlogSchedule.id == schedule.id)
                .values(next_run=calculated_next_run)
            )
            await db.commit()
            print(f"Updated next_run to {calculated_next_run}")
        elif not schedule.is_active and schedule.next_run is not None:
            print("\nSchedule is inactive, clearing next_run field...")
            await db.execute(
                update(BlogSchedule)
                .where(BlogSchedule.id == schedule.id)
                .values(next_run=None)
            )
            await db.commit()
            print("Cleared next_run field")

if __name__ == "__main__":
    # Get schedule ID from command line argument or use default
    schedule_id = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    
    # Run the async function
    asyncio.run(diagnose_schedule(schedule_id)) 