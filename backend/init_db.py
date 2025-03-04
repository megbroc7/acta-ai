#!/usr/bin/env python
import asyncio
import os
import sys
from alembic.config import Config
from alembic import command
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models import Base

async def init_db():
    """Initialize the database with tables and initial data."""
    print("Creating database tables...")
    
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Close engine
    await engine.dispose()
    
    print("Database tables created successfully.")
    
    # Run Alembic migrations
    print("Running Alembic migrations...")
    alembic_cfg = Config("alembic.ini")
    command.stamp(alembic_cfg, "head")
    print("Alembic migrations completed.")

def init_alembic():
    """Initialize Alembic migration environment."""
    print("Initializing Alembic migration environment...")
    
    # Check if migrations directory exists
    if not os.path.exists("migrations"):
        # Create migrations directory
        os.makedirs("migrations")
        
        # Create versions directory
        os.makedirs("migrations/versions")
        
        # Initialize Alembic
        alembic_cfg = Config("alembic.ini")
        command.init(alembic_cfg, "migrations")
        
        print("Alembic migration environment initialized.")
    else:
        print("Alembic migration environment already exists.")

if __name__ == "__main__":
    # Initialize Alembic
    init_alembic()
    
    # Initialize database
    asyncio.run(init_db())
    
    print("Database initialization completed successfully.") 