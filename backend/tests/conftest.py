import os
import pytest
import asyncio
from typing import AsyncGenerator, Dict, Generator
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from datetime import datetime, timedelta

from app.core.database import Base, get_db
from app.core.config import settings
# Import all models to ensure they're registered with Base
from app.models.user import User
from app.models.site import WordPressSite
from app.models.prompt_template import PromptTemplate
from app.models.blog_schedule import BlogSchedule
from app.main import app as main_app
from app.core.security import create_access_token

# Use SQLite for testing with a file-based database
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Create async engine for testing
engine = create_async_engine(
    TEST_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=NullPool
)

# Create test session
TestingSessionLocal = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    print("Creating database tables...")
    async with engine.begin() as conn:
        # Drop all tables first to ensure clean state
        await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        # Print table names for debugging
        await conn.run_sync(lambda sync_conn: print(f"Created tables: {Base.metadata.tables.keys()}"))
    
    async with TestingSessionLocal() as session:
        yield session
    
    print("Dropping database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _get_test_db():
        try:
            yield db_session
        finally:
            pass
    
    # Use the main app directly but override the database dependency
    main_app.dependency_overrides[get_db] = _get_test_db
    
    async with AsyncClient(transport=ASGITransport(app=main_app), base_url="http://test") as client:
        yield client

@pytest.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> Dict:
    """Create a test user and return user data with access token"""
    print("Creating test user...")
    user = User(
        email="test@example.com",
        hashed_password="$2b$12$NlWtG0Ffq6NqHjWGkJEu1O1Gn3N8NHw0cKg5cM8YhF/zXy7iALFPq",  # password = "password"
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "id": user.id,
        "email": user.email,
        "access_token": access_token,
        "token_type": "bearer"
    }

@pytest.fixture(scope="function")
async def auth_headers(test_user: Dict) -> Dict:
    """Return authorization headers for authenticated requests"""
    return {"Authorization": f"Bearer {test_user['access_token']}"}

@pytest.fixture(scope="function")
async def test_wordpress_site(db_session: AsyncSession, test_user: Dict) -> Dict:
    """Create a test WordPress site"""
    site = WordPressSite(
        user_id=test_user["id"],
        name="Test WordPress Site",
        url="https://example.com",
        api_url="https://example.com/wp-json/wp/v2",
        username="wpuser",
        app_password="app_password",
        is_active=True
    )
    db_session.add(site)
    await db_session.commit()
    await db_session.refresh(site)
    
    return {
        "id": site.id,
        "name": site.name,
        "url": site.url,
        "api_url": site.api_url
    }

@pytest.fixture(scope="function")
async def test_prompt_template(db_session: AsyncSession, test_user: Dict) -> Dict:
    """Create a test prompt template"""
    template = PromptTemplate(
        user_id=test_user["id"],
        name="Test Prompt Template",
        system_prompt="You are a helpful assistant writing a blog post.",
        topic_generation_prompt="Create a blog post title about {{topic}}.",
        content_generation_prompt="Write a blog post about {{topic}} with {{word_count}} words.",
        placeholders={"topic": "Sample Topic", "word_count": 500}
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)
    
    return {
        "id": template.id,
        "name": template.name,
        "system_prompt": template.system_prompt
    }
