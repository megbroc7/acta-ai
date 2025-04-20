"""
Main API router that includes all API endpoints
"""

from fastapi import APIRouter
from app.api import logs

api_router = APIRouter()

# Include all API routers
api_router.include_router(logs.router, prefix="/logs", tags=["Logging"])

# Add other routers as needed
# api_router.include_router(users.router, prefix="/users", tags=["Users"]) 