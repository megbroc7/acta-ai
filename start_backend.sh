#!/bin/bash

# Exit on error
set -e

echo "=== Starting Acta AI Backend ==="

# Change to backend directory
cd "$(dirname "$0")/backend"
echo "Working directory: $(pwd)"

# Kill any existing uvicorn processes
echo "Killing any existing uvicorn processes..."
pkill -f "uvicorn" || echo "No uvicorn processes found"

# Check for ports in use
echo "Checking if port 8000 is in use..."
if lsof -i :8000 | grep LISTEN > /dev/null 2>&1; then
    echo "Port 8000 is in use. Killing process..."
    lsof -i :8000 -t | xargs kill -9 || echo "Could not kill process on port 8000"
else
    echo "Port 8000 is available"
fi

# Activate virtual environment
echo "Activating virtual environment..."
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "Virtual environment activated"
else
    echo "Virtual environment not found in $(pwd)/venv"
    echo "Creating new virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Virtual environment created and activated"
fi

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check database connection
echo "Checking database connection..."
python -c "
import asyncio
from app.core.database import async_session_factory
async def test_db():
    try:
        async with async_session_factory() as session:
            await session.execute('SELECT 1')
            print('Database connection successful')
    except Exception as e:
        print(f'Database connection failed: {e}')
        exit(1)
asyncio.run(test_db())
" || echo "Database connection test failed, but continuing..."

# Start the backend server
echo "Starting backend server on port 8000..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 