#!/usr/bin/env python
import asyncio
import os
import sys
from alembic.config import Config
from alembic import command
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.future import select
from app.core.config import settings
from app.models import Base
from app.models.user import User
from app.core.security import get_password_hash

async def create_admin_user(engine):
    """Create an admin user if it doesn't exist."""
    print("Checking if admin user exists...")
    
    # Create async session
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # Check if any user exists
        stmt = select(User)
        result = await session.execute(stmt)
        existing_user = result.scalars().first()
        
        if existing_user:
            print("Admin user already exists.")
            return
        
        # Create admin user
        print("Creating admin user...")
        admin_email = "admin@example.com"
        admin_password = "adminpassword"
        hashed_password = get_password_hash(admin_password)
        
        admin_user = User(
            email=admin_email,
            hashed_password=hashed_password,
            full_name="Admin User",
            is_active=True
        )
        
        session.add(admin_user)
        await session.commit()
        
        print(f"Admin user created successfully with email: {admin_email} and password: {admin_password}")

async def init_db():
    """Initialize the database with tables and initial data."""
    print("Creating database tables...")
    
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create admin user
    await create_admin_user(engine)
    
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