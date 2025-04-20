#!/bin/bash

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Acta AI Development Environment${NC}"

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
  echo -e "${YELLOW}Error: Please run this script from the root directory of the project${NC}"
  exit 1
fi

# Function to check if a process is running on a port
check_port() {
  lsof -i:$1 > /dev/null 2>&1
  return $?
}

# Start backend server
if ! check_port 8000; then
  echo -e "${GREEN}Starting backend server...${NC}"
  cd backend
  # Start in background
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
  cd ..
  echo -e "${GREEN}Backend server started with PID: $BACKEND_PID${NC}"
else
  echo -e "${YELLOW}Backend server already running on port 8000${NC}"
fi

# Start frontend server
if ! check_port 3000; then
  echo -e "${GREEN}Starting frontend server...${NC}"
  cd frontend
  npm start &
  FRONTEND_PID=$!
  cd ..
  echo -e "${GREEN}Frontend server started with PID: $FRONTEND_PID${NC}"
else
  echo -e "${YELLOW}Frontend server already running on port 3000${NC}"
fi

echo -e "${GREEN}Development environment is starting...${NC}"
echo -e "${GREEN}Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}Backend: http://localhost:8000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for user to press Ctrl+C
trap "echo -e '${YELLOW}Stopping servers...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" INT
wait 