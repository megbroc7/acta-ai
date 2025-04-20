"""
Script to create the execution_history table directly using SQLAlchemy.
"""
import asyncio
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, MetaData, Table, Index
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.sql import func

# Database connection string
DATABASE_URL = "postgresql+asyncpg://postgres:password@localhost:5432/actaai"

async def create_execution_history_table():
    # Create engine
    engine = create_async_engine(DATABASE_URL)
    
    # Define metadata
    metadata = MetaData()
    
    # Define execution_history table
    execution_history = Table(
        'execution_history', 
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('schedule_id', Integer, ForeignKey("blog_schedules.id"), nullable=False),
        Column('user_id', Integer, ForeignKey("users.id"), nullable=False),
        Column('execution_type', String, nullable=False),
        Column('execution_time', DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column('success', Boolean, default=False, nullable=False),
        Column('error_message', Text, nullable=True),
        Column('post_id', Integer, ForeignKey("blog_posts.id"), nullable=True),
    )
    
    # Create indexes
    Index('ix_execution_history_id', execution_history.c.id)
    Index('ix_execution_history_schedule_id', execution_history.c.schedule_id)
    Index('ix_execution_history_user_id', execution_history.c.user_id)
    
    # Create table
    async with engine.begin() as conn:
        # Create table if it doesn't exist
        await conn.run_sync(lambda conn: metadata.create_all(conn, tables=[execution_history]))
    
    # Close engine
    await engine.dispose()
    
    print("Execution history table created successfully!")

if __name__ == "__main__":
    asyncio.run(create_execution_history_table()) 