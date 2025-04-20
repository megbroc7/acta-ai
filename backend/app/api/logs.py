"""
API endpoints for handling logging from frontend applications
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request, Depends, HTTPException

# Set up specific logger for frontend logs
frontend_logger = logging.getLogger("frontend")

router = APIRouter()

class LogEnvironment(BaseModel):
    """Environment information for frontend logs"""
    userAgent: str
    language: str
    platform: str
    screenSize: str
    referrer: Optional[str] = None
    url: str

class LogEntry(BaseModel):
    """Single log entry from frontend"""
    timestamp: str
    level: str
    message: str
    logger: str
    userId: Optional[str] = None
    sessionId: Optional[str] = None
    environment: LogEnvironment
    logId: str
    # Allow additional fields
    additional_data: Dict[str, Any] = Field(default_factory=dict, alias="data")

class LogBatch(BaseModel):
    """Batch of logs from frontend"""
    logs: List[LogEntry]

@router.post("/logs")
async def receive_logs(request: Request, log_batch: LogBatch):
    """
    Receive and process logs from frontend applications
    
    This endpoint accepts log entries from the frontend and forwards
    them to the appropriate logging system.
    """
    request_id = request.headers.get("X-Request-ID", "unknown")
    client_ip = request.client.host if request.client else "unknown"
    
    # Process each log entry
    for log_entry in log_batch.logs:
        # Convert the log level from frontend to Python logging level
        level = {
            "debug": logging.DEBUG,
            "info": logging.INFO,
            "warn": logging.WARNING,
            "error": logging.ERROR
        }.get(log_entry.level.lower(), logging.INFO)
        
        # Create extra data for the log entry
        extra = {
            "timestamp": log_entry.timestamp,
            "request_id": request_id,
            "client_ip": client_ip,
            "user_id": log_entry.userId,
            "session_id": log_entry.sessionId,
            "environment": log_entry.environment.dict(),
            "log_id": log_entry.logId,
            "source": "frontend",
            "url": log_entry.environment.url,
            "browser": log_entry.environment.userAgent,
            "platform": log_entry.environment.platform,
            **log_entry.additional_data
        }
        
        # Log the message with appropriate level
        frontend_logger.log(level, log_entry.message, extra=extra)
    
    return {"status": "ok", "received": len(log_batch.logs)} 