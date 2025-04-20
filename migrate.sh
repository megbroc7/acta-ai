#!/bin/bash
# Script to migrate the database from day_of_week to days_of_week

set -e  # Exit on error

echo "======================================================="
echo "   Starting Migration: day_of_week to days_of_week"
echo "======================================================="

# Find Python executable
PYTHON_CMD="python3"
if ! command -v $PYTHON_CMD &> /dev/null; then
  PYTHON_CMD="python"
  if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "Python not found. Please install Python 3 and try again."
    exit 1
  fi
fi

echo "Using Python: $($PYTHON_CMD --version)"

# Check if Docker is running
if docker info > /dev/null 2>&1; then
  # Docker is running, use Docker environment
  USE_DOCKER=true
  echo "Docker detected, will use Docker environment"
  
  # Check if Docker Compose is available
  if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install it and try again."
    exit 1
  fi
  
  # Check if the containers are running
  if ! docker-compose ps | grep -q "backend"; then
    echo "Docker containers are not running. Starting them now..."
    docker-compose up -d
    echo "Waiting for containers to start..."
    sleep 10
  fi
else
  # Docker is not running, use local environment
  USE_DOCKER=false
  echo "Docker not detected, will use local environment"
fi

# Check if servers are running and stop them
echo "Checking for running servers..."
BACKEND_PID=$(pgrep -f "uvicorn app.main:app" || echo "")
FRONTEND_PID=$(pgrep -f "npm start" || echo "")

if [ ! -z "$BACKEND_PID" ]; then
  echo "Stopping backend server (PID: $BACKEND_PID)..."
  kill $BACKEND_PID
  sleep 2
fi

if [ ! -z "$FRONTEND_PID" ]; then
  echo "Stopping frontend server (PID: $FRONTEND_PID)..."
  kill $FRONTEND_PID
  sleep 2
fi

echo "Creating directory for migrations if it doesn't exist..."
mkdir -p backend/migrations

echo "Making sure migration script is properly placed..."
if [ ! -f "backend/migrations/migration_day_of_week_to_days_of_week.py" ]; then
  echo "Error: Migration script not found!"
  exit 1
fi

# Initialize migrations package if needed
if [ ! -f "backend/migrations/__init__.py" ]; then
  echo "Creating migrations package __init__.py..."
  touch backend/migrations/__init__.py
fi

if [ "$USE_DOCKER" = true ]; then
  echo "Running database migration in Docker container..."
  docker-compose exec backend python -m migrations.migration_day_of_week_to_days_of_week
  MIGRATION_STATUS=$?
else
  echo "Running database migration in local environment..."
  cd backend
  
  # Check if we need to initialize the database
  if [ ! -f "app.db" ] || [ ! -s "app.db" ]; then
    echo "Local database not found or empty. Initializing database..."
    $PYTHON_CMD -m migrations.init_local_db
    if [ $? -ne 0 ]; then
      echo "Failed to initialize database. Aborting migration."
      cd ..
      exit 1
    fi
  fi
  
  # Try to activate virtual environment if it exists
  if [ -f "venv/bin/activate" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
  else
    echo "No virtual environment found, continuing with system Python"
  fi
  
  $PYTHON_CMD -m migrations.migration_day_of_week_to_days_of_week --local
  MIGRATION_STATUS=$?
  cd ..
fi

if [ $MIGRATION_STATUS -ne 0 ]; then
  echo "Migration failed! Check logs for details."
  echo "You can restore backups with ./restore_backups.sh"
  exit 1
fi

echo "Updating models and API endpoints..."
# This will be done in the next steps manually

echo "Migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update the backend models and API endpoints"
echo "2. Update the frontend components"
echo "3. Restart the application with ./setup-and-start.sh"
echo ""
echo "If anything goes wrong, restore backups with:"
echo "  ./restore_backups.sh" 