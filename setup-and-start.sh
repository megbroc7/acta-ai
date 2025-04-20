#!/bin/bash

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Acta AI Setup and Run Script${NC}"

# Check if we're in the right directory
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
  echo -e "${RED}Error: Please run this script from the root directory of the project${NC}"
  exit 1
fi

# Install backend dependencies
echo -e "${GREEN}Installing backend dependencies...${NC}"
cd backend

# Check if Python virtual environment exists, create if not
if [ ! -d "venv" ]; then
  echo -e "${YELLOW}Creating Python virtual environment...${NC}"
  python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install backend dependencies
echo -e "${GREEN}Installing Python dependencies...${NC}"
pip install -r requirements.txt

# Install bcrypt explicitly
echo -e "${GREEN}Installing bcrypt for password hashing...${NC}"
pip install bcrypt

# Deactivate virtual environment
deactivate

# Return to root
cd ..

# Install frontend dependencies
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

# Install root dependencies
echo -e "${GREEN}Installing root dependencies...${NC}"
npm install

# Function to check if a process is running on a port
check_port() {
  lsof -i:$1 > /dev/null 2>&1
  return $?
}

# Function to kill process on a port if running
kill_port_process() {
  echo -e "${YELLOW}Killing process on port $1...${NC}"
  lsof -ti:$1 | xargs kill -9 2>/dev/null || true
}

# Kill existing processes if running
if check_port 8000; then
  kill_port_process 8000
fi

if check_port 3000; then
  kill_port_process 3000
fi

# Start backend server
echo -e "${GREEN}Starting backend server...${NC}"
cd backend
source venv/bin/activate
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
deactivate
cd ..
echo -e "${GREEN}Backend server started with PID: $BACKEND_PID${NC}"
echo -e "${GREEN}Backend logs available at: $(pwd)/backend.log${NC}"

# Start frontend server
echo -e "${GREEN}Starting frontend server...${NC}"
cd frontend
nohup npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo -e "${GREEN}Frontend server started with PID: $FRONTEND_PID${NC}"
echo -e "${GREEN}Frontend logs available at: $(pwd)/frontend.log${NC}"

echo -e "${GREEN}Development environment is starting...${NC}"
echo -e "${GREEN}Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}Backend: http://localhost:8000${NC}"
echo -e "${YELLOW}View backend logs: tail -f backend.log${NC}"
echo -e "${YELLOW}View frontend logs: tail -f frontend.log${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop following logs${NC}"

# Tail both logs
tail -f backend.log frontend.log 