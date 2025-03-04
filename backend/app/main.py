from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .api import auth, sites, schedules, posts, prompts
from .core.database import init_db
from .core.config import settings
from .services.scheduler import SchedulerService
import asyncio
from prometheus_fastapi_instrumentator import Instrumentator

# Initialize scheduler service
scheduler_service = SchedulerService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database and scheduler
    await init_db()
    scheduler_task = asyncio.create_task(initialize_scheduler())
    
    # Setup metrics
    Instrumentator().instrument(app).expose(app)
    
    yield  # Application runs here
    
    # Shutdown: Cancel any running tasks
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if isinstance(settings.CORS_ORIGINS, str) else settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def initialize_scheduler():
    """Initialize scheduler with existing schedules from database."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.future import select
    from .core.database import get_session
    from .models.blog_schedule import BlogSchedule
    
    try:
        async with get_session() as db:
            # Get all active schedules
            result = await db.execute(
                select(BlogSchedule).where(BlogSchedule.is_active == True)
            )
            schedules = result.scalars().all()
            
            # Schedule each active schedule
            for schedule in schedules:
                await scheduler_service.schedule_post(db, schedule.id)
    except Exception as e:
        print(f"Error initializing scheduler: {str(e)}")

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(sites.router, prefix=f"{settings.API_V1_STR}/sites", tags=["WordPress Sites"])
app.include_router(schedules.router, prefix=f"{settings.API_V1_STR}/schedules", tags=["Schedules"])
app.include_router(posts.router, prefix=f"{settings.API_V1_STR}/posts", tags=["Blog Posts"])
app.include_router(prompts.router, prefix=f"{settings.API_V1_STR}/prompts", tags=["Prompt Templates"])

@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "healthy"} 