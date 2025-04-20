# Acta AI - WordPress Autoblogger

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.9 or higher)
- PostgreSQL

### Quick Setup

The easiest way to get started is using our setup script:

```bash
./setup-and-start.sh
```

This will:
1. Install all dependencies (backend, frontend, and root)
2. Create a Python virtual environment if needed
3. Install bcrypt explicitly (required for password hashing)
4. Stop any existing processes on ports 3000 and 8000
5. Start both the frontend and backend servers
6. Show logs from both servers

### Manual Installation

If you prefer to install manually:

1. Install dependencies:
   ```
   npm run install:all
   ```

2. Start both servers:
   ```
   npm start
   ```

## Development

- Frontend: React application in the `frontend` directory
- Backend: FastAPI application in the `backend` directory

## API Structure

- Authentication: `/api/auth/*`
- WordPress Sites: `/api/sites/*`
- Schedules: `/api/schedules/*`
- Blog Posts: `/api/posts/*`
- Prompt Templates: `/api/templates/*`

## Troubleshooting

### CORS Issues

If you encounter CORS errors, check:
1. The backend CORS configuration in `backend/app/main.py`
2. The API URL in your frontend (should match backend URL)
3. Ensure your frontend's package.json has the correct proxy setting

### API Path Issues

If you encounter 404 errors on API calls:
1. Verify the API paths used in your frontend code
2. Run the API path fixer script to standardize paths:
   ```
   node fix-api-paths.js
   ```

### Authentication Issues

If you have login problems:
1. Ensure bcrypt is installed for password hashing:
   ```
   pip install bcrypt
   ```
2. Verify the auth endpoints are correctly configured

### Process Management

To check running processes:
```
ps aux | grep -i "node.*start\|python.*uvicorn" | grep -v grep
```

To kill processes on specific ports:
```
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
lsof -ti:8000 | xargs kill -9  # Kill process on port 8000
```
