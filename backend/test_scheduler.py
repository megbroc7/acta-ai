import asyncio
from app.services.scheduler import SchedulerService
from app.core.database import async_session_factory
from sqlalchemy.future import select
from app.models.blog_schedule import BlogSchedule

async def test_scheduler():
    print('Testing scheduler service...')
    try:
        # Create scheduler service
        scheduler = SchedulerService()
        print('Scheduler service created successfully')
        
        # Find a valid schedule ID
        async with async_session_factory() as session:
            stmt = select(BlogSchedule)
            result = await session.execute(stmt)
            schedules = result.scalars().all()
            
            if not schedules:
                print('No schedules found in the database. Test cannot continue.')
                return False
            
            # Use the first schedule
            schedule = schedules[0]
            schedule_id = schedule.id
            print(f'Found schedule with ID {schedule_id}, name: {schedule.name}')
        
        # Test the _generate_and_post method directly
        print(f'Testing _generate_and_post with schedule ID {schedule_id}...')
        await scheduler._generate_and_post(schedule_id)
        print('_generate_and_post completed successfully')
        
        return True
    except Exception as e:
        print(f'Error: {str(e)}')
        import traceback
        print(traceback.format_exc())
        return False

asyncio.run(test_scheduler()) 