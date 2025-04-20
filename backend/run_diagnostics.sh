#!/bin/bash
# Comprehensive diagnostic script for the Acta AI backend

echo "===== Starting Acta AI Backend Diagnostics ====="

# Check if we're in the backend directory
if [ ! -f "run.sh" ]; then
    echo "Error: This script should be run from the backend directory (where run.sh is located)"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Try to detect the virtual environment
if [ -d "venv" ]; then
    VENV_PATH="venv"
elif [ -d "env" ]; then
    VENV_PATH="env"
elif [ -d ".venv" ]; then
    VENV_PATH=".venv"
else
    echo "Warning: Could not find a virtual environment directory (venv, env, or .venv)"
    echo "Will try to run with system Python"
    VENV_PATH=""
fi

# Activate virtual environment if found
if [ -n "$VENV_PATH" ]; then
    echo "Using virtual environment: $VENV_PATH"
    if [ -f "$VENV_PATH/bin/activate" ]; then
        source "$VENV_PATH/bin/activate"
        echo "Activated virtual environment: $(which python)"
    else
        echo "Warning: Could not find activate script in $VENV_PATH/bin"
        echo "Will try to run with system Python"
    fi
fi

# Check if Python is available
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "Error: Python not found. Please install Python or activate your virtual environment."
    exit 1
fi

# Determine Python command
PYTHON_CMD="python"
if ! command -v python &> /dev/null && command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
fi

echo -e "\n===== Running Environment Diagnostics ====="
$PYTHON_CMD diagnose_environment.py

echo -e "\n===== Running API Response Diagnostics ====="
# Check if the server is running first
if curl -s http://localhost:8000/api/health &>/dev/null; then
    $PYTHON_CMD diagnose_api_response.py
else
    echo "Warning: Backend server not running at http://localhost:8000"
    echo "Start the server and then run: python diagnose_api_response.py"
fi

echo -e "\n===== Diagnostic Summary ====="
echo "1. Fix package dependencies:"
echo "   - Make sure pydantic is installed: pip install pydantic"
echo "   - Make sure all dependencies are installed: pip install -r requirements.txt"

echo -e "\n2. Fix SQLAlchemy serialization issues:"
echo "   - Run: python fix_sqlalchemy_serialization.py"
echo "   - This will help fix the MissingGreenlet error"

echo -e "\n3. Fix APScheduler compatibility issues:"
echo "   - Run: python fix_apscheduler.py"
echo "   - This will fix the 'ignore_if_not_exists' error"

echo -e "\n4. After fixing these issues, restart the backend server:"
echo "   - Kill any running backend processes: pkill -f uvicorn"
echo "   - Start the server with: ./run.sh"

echo -e "\n===== Diagnostic Complete =====" 