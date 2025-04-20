import asyncio
import sys
import logging
from datetime import datetime
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("schedule_execution_trace.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("schedule_tracer")

async def trace_schedule_execution(schedule_id):
    """Trace through what happens when a schedule is executed."""
    logger.info(f"Starting trace of schedule execution for schedule ID {schedule_id}")
    
    # Database connection string
    DATABASE_URL = 'postgresql+asyncpg://postgres:password@localhost:5432/actaai'
    
    # Create engine
    engine = create_async_engine(DATABASE_URL)
    
    # Create session
    async with AsyncSession(engine) as session:
        try:
            # Step 1: Get the schedule
            logger.info("Step 1: Getting schedule details")
            result = await session.execute(
                text(f'SELECT id, name, user_id, site_id, prompt_template_id, is_active FROM blog_schedules WHERE id={schedule_id}')
            )
            schedule = result.first()
            
            if not schedule:
                logger.error(f"Schedule with ID {schedule_id} not found")
                return
                
            logger.info(f"Found schedule: {schedule[1]} (ID: {schedule[0]})")
            logger.info(f"  User ID: {schedule[2]}")
            logger.info(f"  Site ID: {schedule[3]}")
            logger.info(f"  Prompt Template ID: {schedule[4]}")
            logger.info(f"  Is Active: {schedule[5]}")
            
            if not schedule[5]:
                logger.warning("Schedule is not active - this would cause execution to fail")
            
            # Step 2: Check if WordPress site exists
            logger.info("Step 2: Checking WordPress site")
            result = await session.execute(
                text(f'SELECT id, name, url, is_active FROM wordpress_sites WHERE id={schedule[3]}')
            )
            site = result.first()
            
            if not site:
                logger.error(f"WordPress site with ID {schedule[3]} not found - this would cause execution to fail")
                return
                
            logger.info(f"Found WordPress site: {site[1]} (ID: {site[0]})")
            logger.info(f"  URL: {site[2]}")
            logger.info(f"  Is Active: {site[3]}")
            
            if not site[3]:
                logger.warning("WordPress site is not active - this would cause execution to fail")
            
            # Step 3: Check if prompt template exists
            logger.info("Step 3: Checking prompt template")
            result = await session.execute(
                text(f'SELECT id, name, system_prompt FROM prompt_templates WHERE id={schedule[4]}')
            )
            template = result.first()
            
            if not template:
                logger.error(f"Prompt template with ID {schedule[4]} not found - this would cause execution to fail")
                return
                
            logger.info(f"Found prompt template: {template[1]} (ID: {template[0]})")
            prompt_preview = template[2][:100] + "..." if template[2] and len(template[2]) > 100 else template[2]
            logger.info(f"  System Prompt: {prompt_preview}")
            
            # Step 4: Check execution history records
            logger.info("Step 4: Checking existing execution history records")
            result = await session.execute(
                text(f'SELECT COUNT(*) FROM execution_history WHERE schedule_id={schedule_id}')
            )
            count = result.scalar()
            logger.info(f"Found {count} existing execution history records for this schedule")
            
            # Step 5: Create a test execution history record to verify database access
            logger.info("Step 5: Attempting to create a test execution history record")
            try:
                now = datetime.now().isoformat()
                stmt = text(f"""
                INSERT INTO execution_history 
                (schedule_id, user_id, execution_type, execution_time, success, error_message)
                VALUES 
                ({schedule_id}, {schedule[2]}, 'test', '{now}', true, 'Test record from tracer')
                RETURNING id
                """)
                
                result = await session.execute(stmt)
                record_id = result.scalar()
                await session.commit()
                
                if record_id:
                    logger.info(f"Successfully created test execution history record with ID {record_id}")
                else:
                    logger.error("Failed to create test execution history record - no ID returned")
            except Exception as e:
                await session.rollback()
                logger.error(f"Error creating test execution history record: {str(e)}")
                
            logger.info("Schedule execution trace completed")
                
        except Exception as e:
            logger.error(f"Error during trace: {str(e)}")
            sys.exit(1)
        finally:
            await engine.dispose()

# Run the async function
if __name__ == "__main__":
    schedule_id = 7  # Change this to the schedule ID you want to trace
    asyncio.run(trace_schedule_execution(schedule_id)) 