#!/usr/bin/env python3
"""
Diagnostic script to identify issues with the Acta AI backend environment
"""

import sys
import importlib
import pkg_resources
import os
import json
from datetime import datetime, timezone
from pathlib import Path

print("===== Environment Diagnostic =====")
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")

# Check current directory
print(f"\nCurrent working directory: {os.getcwd()}")
backend_dir = Path(os.getcwd())
print(f"Backend directory exists: {backend_dir.exists()}")

# Check critical packages
critical_packages = [
    "fastapi", 
    "pydantic", 
    "sqlalchemy", 
    "apscheduler", 
    "uvicorn",
    "greenlet"
]

print("\n===== Critical Package Versions =====")
for package in critical_packages:
    try:
        pkg = importlib.import_module(package)
        version = pkg_resources.get_distribution(package).version
        print(f"{package}: {version} (INSTALLED)")
    except (ImportError, pkg_resources.DistributionNotFound):
        print(f"{package}: NOT INSTALLED")

# Check virtual environment
print("\n===== Virtual Environment =====")
venv = os.environ.get("VIRTUAL_ENV")
if venv:
    print(f"Active virtual environment: {venv}")
else:
    print("No active virtual environment detected")

# Check datetime formatting for JavaScript
print("\n===== DateTime Format Test =====")
now = datetime.now(timezone.utc)
formats = {
    "isoformat()": now.isoformat(),
    "isoformat(' ')": now.isoformat(' '),
    "str()": str(now),
    "strftime('%Y-%m-%dT%H:%M:%SZ')": now.strftime('%Y-%m-%dT%H:%M:%SZ'),
    "JSON serialized": json.dumps({"date": now.isoformat()})
}

for name, formatted in formats.items():
    print(f"{name}: {formatted}")

# Test if the directory structure looks correct
print("\n===== Directory Structure =====")
expected_dirs = ["app", "venv", "migrations"]
expected_files = ["run.sh", "alembic.ini"]

for dirname in expected_dirs:
    path = backend_dir / dirname
    print(f"Directory '{dirname}': {'EXISTS' if path.exists() and path.is_dir() else 'MISSING'}")

for filename in expected_files:
    path = backend_dir / filename
    print(f"File '{filename}': {'EXISTS' if path.exists() and path.is_file() else 'MISSING'}")

# Check for app module
print("\n===== Module Import Test =====")
try:
    sys.path.insert(0, str(backend_dir))
    from app.main import app
    print("Successfully imported 'app.main.app'")
except ImportError as e:
    print(f"Failed to import 'app.main.app': {str(e)}")
except Exception as e:
    print(f"Error importing 'app.main.app': {type(e).__name__}: {str(e)}") 