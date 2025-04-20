#!/bin/bash

# Exit on error
set -e

echo "=== Starting Acta AI Frontend ==="

# Change to frontend directory
cd "$(dirname "$0")/frontend"
echo "Working directory: $(pwd)"

# Kill any existing React development server
echo "Killing any existing React development servers..."
pkill -f "node.*start" || echo "No React development servers found"

# Check for ports in use
echo "Checking if port 3000 is in use..."
if lsof -i :3000 | grep LISTEN > /dev/null 2>&1; then
    echo "Port 3000 is in use. Killing process..."
    lsof -i :3000 -t | xargs kill -9 || echo "Could not kill process on port 3000"
else
    echo "Port 3000 is available"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "Frontend dependencies already installed"
fi

# Start the frontend server
echo "Starting frontend server on port 3000..."
npm start 