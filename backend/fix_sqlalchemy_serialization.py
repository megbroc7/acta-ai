#!/usr/bin/env python3
"""
Solution script for SQLAlchemy serialization issues
"""

import os
import sys
from pathlib import Path

# This script provides complete solutions for SQLAlchemy serialization issues
# that cause "MissingGreenlet: greenlet_spawn has not been called" errors

SCHEDULE_RESPONSE_FIX = """from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, time
import json

# Define Pydantic models for safe serialization of SQLAlchemy objects

class ScheduleBase(BaseModel):
    name: str
    frequency: str
    time_of_day: str
    active: bool
    site: Optional[str] = None
    
    class Config:
        from_attributes = True  # Formerly orm_mode=True in Pydantic v1

class ScheduleResponse(ScheduleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    next_run: Optional[datetime] = None
    next_run_at: Optional[str] = None  # String for JS-friendly dates
    
    # Helper method to safely convert from ORM objects
    @classmethod
    def from_orm_safe(cls, obj):
        # First convert to dict to avoid async context issues
        obj_dict = {
            "id": getattr(obj, "id", None),
            "name": getattr(obj, "name", ""),
            "frequency": getattr(obj, "frequency", ""),
            "time_of_day": getattr(obj, "time_of_day", ""),
            "active": getattr(obj, "active", False),
            "site": getattr(obj, "site", None),
            "created_at": getattr(obj, "created_at", None),
            "updated_at": getattr(obj, "updated_at", None),
            "next_run": getattr(obj, "next_run", None),
        }
        
        # Add next_run_at as string if next_run exists
        if obj_dict["next_run"] and hasattr(obj_dict["next_run"], "isoformat"):
            obj_dict["next_run_at"] = obj_dict["next_run"].isoformat()
        else:
            obj_dict["next_run_at"] = None
            
        return cls(**obj_dict)
        
def print_fix_instructions():
    print("===== SQLAlchemy Serialization Fix Instructions =====")
    print("\nTo fix the 'MissingGreenlet' error, you need to:")
    
    print("\n1. Create a file at 'app/schemas/schedule.py' with Pydantic models")
    print("   (see the ScheduleResponse model defined in this script)")
    
    print("\n2. Modify the API routes to use the safe_from_orm method:")
    print("   Instead of: return db_schedule")
    print("   Use: return ScheduleResponse.from_orm_safe(db_schedule)")
    
    print("\n3. For list endpoints, use list comprehension:")
    print("   return [ScheduleResponse.from_orm_safe(schedule) for schedule in schedules]")
    
    print("\n4. Make sure all datetime fields are properly formatted:")
    print("   If next_run exists and has .isoformat(), use next_run.isoformat()")

def create_schema_file():
    """Create the schedule schema file with safe serialization"""
    try:
        # Check if we're in the backend directory
        backend_dir = Path(os.getcwd())
        schemas_dir = backend_dir / "app" / "schemas"
        
        if not schemas_dir.exists():
            print(f"Creating schemas directory at {schemas_dir}")
            schemas_dir.mkdir(parents=True, exist_ok=True)
        
        target_file = schemas_dir / "schedule.py"
        print(f"Creating/updating schema file at {target_file}")
        
        with open(target_file, "w") as f:
            f.write(SCHEDULE_RESPONSE_FIX)
            
        print(f"Successfully created {target_file}")
        return True
    except Exception as e:
        print(f"Error creating schema file: {str(e)}")
        return False

def main():
    print_fix_instructions()
    
    choice = input("\nDo you want to create the ScheduleResponse schema file? (y/n): ")
    if choice.lower() == 'y':
        success = create_schema_file()
        if success:
            print("\nSchema file created. Now you need to update your API routes to use the new models.")
            print("Look for all functions in app/api/schedules.py that return schedule objects")
            print("and modify them to use ScheduleResponse.from_orm_safe().")
        else:
            print("\nFailed to create schema file. Make sure you're in the backend directory.")
    else:
        print("\nNo changes made. You'll need to implement the fix manually.")
    
    print("\nRemember: The key to fixing the MissingGreenlet error is to fully serialize")
    print("SQLAlchemy objects to dictionaries or Pydantic models BEFORE returning them from API routes.")

if __name__ == "__main__":
    main() 