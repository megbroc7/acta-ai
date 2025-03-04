from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Create async engine
engine = create_async_engine(settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"))
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def init_db():
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Alias for get_db to maintain compatibility with scheduler service
get_session = get_db 