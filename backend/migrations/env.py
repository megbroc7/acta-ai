import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from app.core.database import Base  # Import Base from database.py instead of models
target_metadata = Base.metadata

# Import models to ensure they are registered with the metadata
from app.models.user import User
from app.models.site import WordPressSite, Category, Tag
from app.models.prompt_template import PromptTemplate
from app.models.blog_schedule import BlogSchedule, BlogPost

# Import environment variables
from app.core.config import settings

# Override sqlalchemy.url with the DATABASE_URL from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"))

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    # Use the current event loop if available, otherwise create a new one
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're in a running event loop, we need to use a different approach
            # This is a workaround for the "asyncio.run() cannot be called from a running event loop" error
            connectable = async_engine_from_config(
                config.get_section(config.config_ini_section, {}),
                prefix="sqlalchemy.",
                poolclass=pool.NullPool,
            )
            
            connection = loop.run_until_complete(connectable.connect())
            try:
                loop.run_until_complete(connection.run_sync(do_run_migrations))
            finally:
                loop.run_until_complete(connection.close())
                loop.run_until_complete(connectable.dispose())
        else:
            # If we're not in a running event loop, we can use asyncio.run
            asyncio.run(run_async_migrations())
    except RuntimeError:
        # If we can't get the event loop, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_async_migrations())
        finally:
            loop.close()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online() 