from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.api.auth import router as auth_router
from app.api.sites import router as sites_router
from app.api.templates import router as templates_router
from app.api.schedules import router as schedules_router
from app.api.posts import router as posts_router
from app.api.feedback import router as feedback_router
from app.api.admin import router as admin_router
from app.services.scheduler import get_scheduler_status, start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify database connection
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    # Start the scheduling engine
    await start_scheduler()
    print(f"✓ {settings.PROJECT_NAME} backend started")
    yield
    # Shutdown
    await stop_scheduler()
    await engine.dispose()
    print(f"✗ {settings.PROJECT_NAME} backend stopped")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(sites_router, prefix=settings.API_V1_STR)
app.include_router(templates_router, prefix=settings.API_V1_STR)
app.include_router(schedules_router, prefix=settings.API_V1_STR)
app.include_router(posts_router, prefix=settings.API_V1_STR)
app.include_router(feedback_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "scheduler": get_scheduler_status(),
    }
