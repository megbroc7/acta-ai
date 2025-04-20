#!/bin/bash

# Stop any running servers
echo "Stopping any running servers..."
pkill -f "node.*start\.js" || true
pkill -f "uvicorn.*app\.main:app" || true

# Wait for processes to fully stop
sleep 2

# Function to check if port is in use
port_in_use() {
  lsof -i:$1 | grep LISTEN >/dev/null
  return $?
}

# Check if port 3000 is still in use
if port_in_use 3000; then
  echo "Port 3000 is still in use. Please stop the process manually."
  lsof -i:3000 | grep LISTEN
  exit 1
fi

# Check if port 8000 is still in use
if port_in_use 8000; then
  echo "Port 8000 is still in use. Please stop the process manually."
  lsof -i:8000 | grep LISTEN
  exit 1
fi

# Start backend
echo "Starting backend server..."
cd "$(dirname "$0")/backend"
source venv/bin/activate
nohup python -m uvicorn app.main:app --reload --port 8000 > ../backend.log 2>&1 &
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 3

# Start frontend
echo "Starting frontend server..."
cd "$(dirname "$0")/frontend"
nohup npm start > ../frontend.log 2>&1 &
cd ..

echo "Development servers started!"
echo "Backend running on: http://localhost:8000"
echo "Frontend running on: http://localhost:3000"
echo "Check backend.log and frontend.log for any issues." 