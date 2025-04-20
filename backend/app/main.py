from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .api import auth, sites, schedules, posts, prompts
from .core.database import init_db
from .core.config import settings
from .services.scheduler import SchedulerService
import asyncio
from prometheus_fastapi_instrumentator import Instrumentator
import datetime
import time
import os
import logging
import psutil
import threading
import uuid
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import configure_logging, log_request_middleware
from app.core.metrics import setup_metrics, update_resource_metrics

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

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    version="1.0.0",
    lifespan=lifespan
)

# Setup structured logging
configure_logging()

# Setup metrics collection
setup_metrics(app)

# Setup metrics - moved outside lifespan
Instrumentator().instrument(app).expose(app)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request ID middleware
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        request_id = str(uuid.uuid4())
        # Add request_id to request state
        request.state.request_id = request_id
        # Add request_id to response headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)

# Add logging middleware
app.middleware("http")(log_request_middleware)

async def initialize_scheduler():
    """Initialize the scheduler service and start the scheduler."""
    try:
        print("Initializing scheduler...")
        # Get database session for background tasks
        from sqlalchemy.ext.asyncio import AsyncSession
        from .core.database import async_session_factory
        
        async with async_session_factory() as db:
            # Initialize the scheduler
            try:
                await scheduler_service.init_scheduler()
            except AttributeError as e:
                print(f"AttributeError initializing scheduler: {str(e)}")
                print(f"Available methods: {dir(scheduler_service)}")
                raise
            
            # Start the scheduler (this will run until the application shuts down)
            await scheduler_service.start_scheduler()
            
            # Load existing schedules from database
            from sqlalchemy.future import select
            from .models.blog_schedule import BlogSchedule
            
            stmt = select(BlogSchedule).where(BlogSchedule.is_active == True)
            result = await db.execute(stmt)
            schedules = result.scalars().all()
            
            # Schedule each active schedule
            for schedule in schedules:
                await scheduler_service.schedule_post(db, schedule.id)
                
            print(f"Scheduled {len(schedules)} active blog schedules")
            
            # Keep the task alive
            while True:
                await asyncio.sleep(60)  # Check every minute
    except Exception as e:
        print(f"Error initializing scheduler: {str(e)}")

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(sites.router, prefix=f"{settings.API_V1_STR}/sites", tags=["WordPress Sites"])
app.include_router(schedules.router, prefix=f"{settings.API_V1_STR}/schedules", tags=["Schedules"])
app.include_router(posts.router, prefix=f"{settings.API_V1_STR}/posts", tags=["Blog Posts"])
app.include_router(prompts.router, prefix=f"{settings.API_V1_STR}/templates", tags=["Prompt Templates"])

@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs": "/docs"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger = logging.getLogger("app")
    logger.error(
        f"Unhandled exception occurred",
        extra={
            "request_id": getattr(request.state, "request_id", "unknown"),
            "method": request.method,
            "path": request.url.path,
            "exception": str(exc),
            "exception_type": type(exc).__name__,
        },
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Start resource metrics collection thread
def collect_resource_metrics():
    """Collect and update resource metrics periodically."""
    while True:
        try:
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            memory_bytes = memory_info.rss  # Resident Set Size
            cpu_percent = process.cpu_percent(interval=1.0)
            
            update_resource_metrics(memory_bytes, cpu_percent)
        except Exception as e:
            logging.getLogger("app").error(f"Error collecting resource metrics: {str(e)}")
        
        time.sleep(15)  # Update every 15 seconds

@app.on_event("startup")
async def startup_event():
    logger = logging.getLogger("app")
    logger.info("Starting application")
    
    # Start resource metrics collection in a background thread
    metrics_thread = threading.Thread(target=collect_resource_metrics, daemon=True)
    metrics_thread.start()

@app.on_event("shutdown")
async def shutdown_event():
    logger = logging.getLogger("app")
    logger.info("Shutting down application")

@app.get("/api/health", include_in_schema=False)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime()),
        "api_version": "v1"
    } 