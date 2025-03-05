from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .api import auth, sites, schedules, posts, prompts
from .core.database import init_db
from .core.config import settings
from .services.scheduler import SchedulerService
import asyncio
from prometheus_fastapi_instrumentator import Instrumentator
import fastapi

# Initialize scheduler service
scheduler_service = SchedulerService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database and scheduler
    await init_db()
    scheduler_task = asyncio.create_task(initialize_scheduler())
    
    # Remove instrumentation from here
    
    yield  # Application runs here
    
    # Shutdown: Cancel any running tasks
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Setup metrics - moved outside lifespan
Instrumentator().instrument(app).expose(app)

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

# Add a route handler for the old API endpoint
@app.api_route("/api/v1/prompts/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def legacy_prompt_redirect(path: str, request: fastapi.Request):
    # This endpoint is no longer used, but some clients might still be requesting it
    # Log the request for debugging
    print(f"Legacy API request: {request.method} /api/v1/prompts/{path}")
    
    # For OPTIONS requests, return a 200 OK response with CORS headers
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            }
        )
    
    # For GET requests to a specific prompt, redirect to the new endpoint
    if request.method == "GET" and path.isdigit():
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"/api/prompts/templates/{path}")
    
    # For other requests, return a 404 Not Found response
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found. The API has been updated."}
    )

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