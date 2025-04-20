"""
Logging configuration module for Acta AI backend
"""
import os
import sys
import time
import logging
import yaml
import json
from pathlib import Path
from logging import config
from datetime import datetime
import traceback
from pythonjsonlogger import jsonlogger

# Get app environment
APP_ENV = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Set up log directory
LOG_DIR = Path("/var/log/acta-ai")
if APP_ENV == "development":
    LOG_DIR = Path("./logs")

# Create log directory if it doesn't exist
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Load the logging configuration file
def load_config():
    config_path = Path(__file__).parent.parent.parent.parent / "logging-config.yml"
    
    if not config_path.exists():
        # Use default config if file doesn't exist
        return setup_default_config()
    
    with open(config_path, 'r') as f:
        log_config = yaml.safe_load(f)
    
    # Override log file paths if needed
    for handler_name, handler in log_config.get("handlers", {}).items():
        if "filename" in handler:
            filename = Path(handler["filename"]).name
            handler["filename"] = str(LOG_DIR / filename)
    
    return log_config

def setup_default_config():
    """Setup default logging config if config file not found"""
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "json": {
                "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": LOG_LEVEL,
                "formatter": "standard",
                "stream": "ext://sys.stdout"
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": LOG_LEVEL,
                "formatter": "json",
                "filename": str(LOG_DIR / "app.log"),
                "maxBytes": 10485760,
                "backupCount": 20,
                "encoding": "utf8"
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "json",
                "filename": str(LOG_DIR / "error.log"),
                "maxBytes": 10485760,
                "backupCount": 20,
                "encoding": "utf8"
            }
        },
        "loggers": {
            "app": {
                "level": LOG_LEVEL,
                "handlers": ["console", "file", "error_file"],
                "propagate": False
            }
        },
        "root": {
            "level": LOG_LEVEL,
            "handlers": ["console", "file", "error_file"],
            "propagate": False
        }
    }

# Custom JSON formatter with extra fields
class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        log_record['timestamp'] = datetime.utcnow().isoformat()
        log_record['environment'] = APP_ENV
        log_record['app'] = 'acta-ai-backend'
        
        # Include exception info if available
        if record.exc_info:
            log_record['exception'] = traceback.format_exception(*record.exc_info)
            
        # Include request info if available
        if hasattr(record, 'request'):
            req = record.request
            log_record['request'] = {
                'method': req.method,
                'url': str(req.url),
                'client': req.client.host if req.client else None,
                'user_agent': req.headers.get('user-agent')
            }

# Configure logging
def configure_logging():
    """Configure logging for the application"""
    try:
        log_config = load_config()
        config.dictConfig(log_config)
        
        # Add custom formatter if needed
        for handler in logging.root.handlers:
            if isinstance(handler, logging.FileHandler) and handler.formatter and isinstance(handler.formatter, jsonlogger.JsonFormatter):
                handler.setFormatter(CustomJsonFormatter())
                
        logging.info("Logging configured successfully", extra={"event_type": "system_startup"})
    except Exception as e:
        # Fallback to basic configuration if there's an error
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout)
            ]
        )
        logging.error(f"Error configuring logging: {str(e)}", exc_info=True)

# Get logger
def get_logger(name):
    """Get a logger with the given name"""
    return logging.getLogger(name)

# Create request logger middleware
async def log_request_middleware(request, call_next):
    """Log request and response details"""
    logger = logging.getLogger("access")
    start_time = time.time()
    
    # Extract request details
    request_id = request.headers.get("X-Request-ID", "-")
    user_agent = request.headers.get("User-Agent", "-")
    forwarded_for = request.headers.get("X-Forwarded-For", "-")
    method = request.method
    url = str(request.url)
    
    # Log request
    logger.info(f"{method} {url} started", 
                extra={
                    "request_id": request_id,
                    "client_ip": forwarded_for,
                    "user_agent": user_agent,
                    "method": method,
                    "url": url,
                    "event_type": "request_started"
                })
    
    try:
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response
        logger.info(
            f"{method} {url} completed in {process_time:.4f}s with status {response.status_code}",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "process_time": process_time,
                "method": method,
                "url": url,
                "event_type": "request_completed"
            }
        )
        
        return response
    except Exception as e:
        # Log exception
        process_time = time.time() - start_time
        logger.error(
            f"{method} {url} failed in {process_time:.4f}s with error: {str(e)}",
            exc_info=True,
            extra={
                "request_id": request_id,
                "method": method,
                "url": url,
                "process_time": process_time,
                "error": str(e),
                "event_type": "request_failed"
            }
        )
        raise

# Initialize logging on module import
configure_logging() 