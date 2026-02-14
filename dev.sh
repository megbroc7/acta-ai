#!/bin/bash
# Start Acta AI development servers
# Usage: ./dev.sh

export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/node@22/bin:$PATH"

echo "Starting Acta AI dev environment..."

# Start backend
echo "→ Starting backend on http://localhost:8000"
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "→ Starting frontend on http://localhost:5173"
cd ../frontend && npx vite --host &
FRONTEND_PID=$!

echo ""
echo "Acta AI is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/api/v1/docs"
echo ""
echo "Press Ctrl+C to stop all servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
