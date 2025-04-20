#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check if database initialization is needed
if [ "$1" == "--init-db" ]; then
    echo "Initializing database..."
    python init_db.py
    echo "Database initialization completed."
fi

# Run the application
echo "Starting Acta AI application..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 