from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Process the connection URL to ensure it uses the correct driver
connection_url = settings.DATABASE_URL
if 'postgresql://' in connection_url and not 'postgresql+asyncpg://' in connection_url:
    connection_url = connection_url.replace('postgresql://', 'postgresql+asyncpg://')

# Don't add the query parameter - it was causing errors
# if '?' not in connection_url:
#     connection_url += "?connect_timeout=5"

logger.info(f"Using database connection URL: {connection_url}")

# Create async engine with explicit timeouts
engine = create_async_engine(
    connection_url,
    pool_pre_ping=True,  # Test connection before using it
    pool_recycle=300,    # Recycle connections after 5 minutes
    pool_timeout=5,      # Timeout when waiting for a connection from the pool
    connect_args={
        "command_timeout": 5  # Use command_timeout instead of connect_timeout
    }
)

# Create async session factory
async_session_factory = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Add an alias for backward compatibility
async_session_maker = async_session_factory

# Define Base model
Base = declarative_base()

async def init_db():
    """Initialize database tables if they don't exist."""
    try:
        async with engine.begin() as conn:
            logger.info("Creating database tables if they don't exist")
            # Create all tables from models that inherit from Base
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {str(e)}")

async def get_db():
    """Get a database session."""
    async with async_session_factory() as session:
        yield session

def get_session():
    """Create a new session directly."""
    return async_session_factory()

def get_async_engine():
    """Return the async engine."""
    return engine 