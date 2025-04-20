#!/bin/bash

# Backend setup script for Acta AI
echo "Setting up Python environment for Acta AI backend..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 first."
    echo "Visit https://www.python.org/downloads/ for installation instructions."
    exit 1
fi

# Create virtual environment
echo "Creating virtual environment..."
cd backend
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Initialize database
echo "Initializing database..."
python init_db.py

echo "Backend setup complete!"
echo "You can now run the backend with: cd backend && source venv/bin/activate && python -m uvicorn app.main:app --reload" 