"""Maintenance mode helpers.

Single-row query against app_settings to check/report maintenance state.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_settings import AppSettings


async def is_maintenance_mode(db: AsyncSession) -> bool:
    """Return True if maintenance mode is active."""
    result = await db.execute(select(AppSettings.maintenance_mode).where(AppSettings.id == 1))
    row = result.scalar_one_or_none()
    return bool(row)


async def get_maintenance_status(db: AsyncSession) -> dict:
    """Return maintenance state details."""
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        return {"maintenance_mode": False, "message": None, "updated_at": None}
    return {
        "maintenance_mode": settings.maintenance_mode,
        "message": settings.maintenance_message,
        "updated_at": settings.updated_at,
    }
