from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, time
import json

# Define Pydantic models for safe serialization of SQLAlchemy objects

class ScheduleBase(BaseModel):
    """Base model for Schedule data."""
    name: str
    frequency: str
    time_of_day: str
    is_active: bool
    site: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True  # Formerly orm_mode=True in Pydantic v1

class ScheduleResponse(ScheduleBase):
    """Response model for Schedule data with safe serialization."""
    id: int
    created_at: datetime
    updated_at: datetime
    next_run: Optional[datetime] = None
    next_run_at: Optional[str] = None  # String for JS-friendly dates
    prompt: Optional[Dict[str, Any]] = None  # Prompt template data
    prompt_template: Optional[Dict[str, Any]] = None  # For backward compatibility
    
    # Helper method to safely convert from ORM objects
    @classmethod
    def from_orm_safe(cls, obj):
        """
        Safely convert an ORM object to this Pydantic model.
        This prevents the MissingGreenlet error by extracting 
        attributes outside of the async context.
        """
        # First convert to dict to avoid async context issues
        obj_dict = {
            "id": getattr(obj, "id", None),
            "name": getattr(obj, "name", ""),
            "frequency": getattr(obj, "frequency", ""),
            "time_of_day": getattr(obj, "time_of_day", ""),
            "is_active": getattr(obj, "is_active", False),
            "site": None,  # Initialize with None, will be populated separately
            "created_at": getattr(obj, "created_at", None),
            "updated_at": getattr(obj, "updated_at", None),
            "next_run": getattr(obj, "next_run", None),
            "prompt": None,  # Initialize with None, populated separately
            "prompt_template": None,  # Initialize with None, populated separately
        }
        
        # Add next_run_at as string if next_run exists
        if obj_dict["next_run"] and hasattr(obj_dict["next_run"], "isoformat"):
            obj_dict["next_run_at"] = obj_dict["next_run"].isoformat()
        else:
            obj_dict["next_run_at"] = None
            
        return cls(**obj_dict) 