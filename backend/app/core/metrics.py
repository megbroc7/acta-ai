"""
Metrics middleware and instrumentation for the Acta AI backend application.
This module defines Prometheus metrics for FastAPI and provides middleware for collecting metrics.
"""

import time
from typing import Callable
from prometheus_client import Counter, Histogram, Gauge, multiprocess, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from starlette.types import ASGIApp

# Define metrics
REQUEST_COUNT = Counter(
    'http_requests_total', 
    'Total count of requests', 
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds', 
    'HTTP request latency in seconds',
    ['method', 'endpoint']
)

REQUESTS_IN_PROGRESS = Gauge(
    'http_requests_in_progress',
    'Number of requests currently being processed',
    ['method', 'endpoint']
)

DEPENDENCIES_LATENCY = Histogram(
    'dependency_request_duration_seconds',
    'External dependency request latency in seconds',
    ['dependency_name']
)

DB_POOL_SIZE = Gauge(
    'db_connection_pool_size',
    'Database connection pool size'
)

DB_POOL_USED = Gauge(
    'db_connection_pool_used',
    'Database connection pool used connections'
)

MEMORY_USAGE = Gauge(
    'process_memory_usage_bytes',
    'Memory usage of the process in bytes'
)

CPU_USAGE = Gauge(
    'process_cpu_usage_percent',
    'CPU usage of the process in percent'
)

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware that collects Prometheus metrics for each request."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next: Callable) -> StarletteResponse:
        method = request.method
        path = request.url.path
        
        # Skip metrics endpoint to avoid recursion
        if path == "/api/metrics":
            return await call_next(request)
        
        # Increment requests in progress
        REQUESTS_IN_PROGRESS.labels(method=method, endpoint=path).inc()
        
        # Record request start time
        start_time = time.time()
        
        # Process request and get response
        try:
            response = await call_next(request)
            
            # Record metrics after request is processed
            status_code = response.status_code
            duration = time.time() - start_time
            
            REQUEST_COUNT.labels(method=method, endpoint=path, status=status_code).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=path).observe(duration)
            
            return response
        except Exception as e:
            # Record error metrics
            status_code = 500  # Default to internal server error
            duration = time.time() - start_time
            
            REQUEST_COUNT.labels(method=method, endpoint=path, status=status_code).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=path).observe(duration)
            
            raise e
        finally:
            # Decrement requests in progress
            REQUESTS_IN_PROGRESS.labels(method=method, endpoint=path).dec()

def setup_metrics(app: FastAPI) -> None:
    """Setup the metrics middleware and endpoint for the FastAPI application."""
    # Add Prometheus middleware
    app.add_middleware(PrometheusMiddleware)
    
    # Define metrics endpoint
    @app.get("/api/metrics", include_in_schema=False)
    async def metrics():
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)

# Utility functions for manual instrumentation

def track_dependency_call(dependency_name: str, func):
    """Decorator to track external dependency calls."""
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            DEPENDENCIES_LATENCY.labels(dependency_name=dependency_name).observe(duration)
            return result
        except Exception as e:
            duration = time.time() - start_time
            DEPENDENCIES_LATENCY.labels(dependency_name=dependency_name).observe(duration)
            raise e
    return wrapper

def update_db_pool_metrics(pool_size: int, used_connections: int):
    """Update database connection pool metrics."""
    DB_POOL_SIZE.set(pool_size)
    DB_POOL_USED.set(used_connections)

def update_resource_metrics(memory_bytes: float, cpu_percent: float):
    """Update process resource usage metrics."""
    MEMORY_USAGE.set(memory_bytes)
    CPU_USAGE.set(cpu_percent) 