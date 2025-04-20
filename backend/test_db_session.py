import asyncio
from app.core.database import async_session_factory
from sqlalchemy.future import select
from app.models.blog_schedule import BlogSchedule

async def test_db_session():
    print('Testing database session with async_session_factory...')
    try:
        # Create session using factory
        session = async_session_factory()
        print('Session created successfully')
        
        # Test a simple query
        stmt = select(BlogSchedule)
        result = await session.execute(stmt)
        schedules = result.scalars().all()
        print(f'Found {len(schedules)} schedules')
        
        # Close the session
        await session.close()
        print('Session closed successfully')
        return True
    except Exception as e:
        print(f'Error: {str(e)}')
        return False

asyncio.run(test_db_session())
