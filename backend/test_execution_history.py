import asyncio
import sys
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from datetime import datetime

async def create_test_history():
    # Database connection string
    DATABASE_URL = 'postgresql+asyncpg://postgres:password@localhost:5432/actaai'
    
    # Create engine
    engine = create_async_engine(DATABASE_URL)
    
    # Create session
    async with AsyncSession(engine) as session:
        try:
            # First check if there are any existing records
            result = await session.execute(text('SELECT COUNT(*) FROM execution_history'))
            count = result.scalar()
            print(f'Before: Execution history table has {count} records')
            
            # Get schedule ID 6 (from URL) and find the user_id
            result = await session.execute(text('SELECT user_id FROM blog_schedules WHERE id = 6'))
            user_id = result.scalar()
            
            if not user_id:
                print("Schedule with ID 6 not found!")
                return
                
            print(f"Found schedule 6 with user_id {user_id}")
            
            # Manually create a test execution history record
            now = datetime.now().isoformat()
            insert_sql = text(f"""
            INSERT INTO execution_history 
            (schedule_id, user_id, execution_type, execution_time, success, error_message)
            VALUES 
            (6, {user_id}, 'manual', '{now}', true, NULL)
            """)
            
            await session.execute(insert_sql)
            await session.commit()
            
            # Check if record was created
            result = await session.execute(text('SELECT COUNT(*) FROM execution_history'))
            count = result.scalar()
            print(f'After: Execution history table has {count} records')
            
            # Show the record
            result = await session.execute(text('SELECT * FROM execution_history ORDER BY id DESC LIMIT 1'))
            record = result.fetchone()
            if record:
                print(f'Created record: ID: {record[0]}, Schedule ID: {record[1]}, User ID: {record[2]}, Type: {record[3]}, Time: {record[4]}, Success: {record[5]}')
            
        except Exception as e:
            print(f'Error: {str(e)}')
            sys.exit(1)

# Run the async function
asyncio.run(create_test_history()) 