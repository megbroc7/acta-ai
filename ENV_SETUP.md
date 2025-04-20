# Environment Setup for Acta AI

This document explains how to set up environment variables for the Acta AI application.

## Required Environment Files

### Root Directory
Create a `.env` file in the root directory with:
```
OPENAI_API_KEY=your-openai-api-key-here
SECRET_KEY=your-secret-key-here
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=acta_ai
```

### Backend
Create a `.env` file in the `backend` directory with:
```
DATABASE_URL=postgresql+asyncpg://postgres:your-secure-password@postgres:5432/acta_ai
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-api-key-here
CORS_ORIGINS=["https://your-domain.com", "http://localhost:3000"]
LOG_LEVEL=INFO
ENVIRONMENT=production
```

### Frontend
Create a `.env` file in the `frontend` directory with:
```
# For production:
REACT_APP_API_URL=https://your-domain.com/api/v1
```

## Environment Templates

Example templates are provided in the repository:
- `.env.example` in the root directory
- `backend/.env.example` 
- `frontend/.env.example`

Copy these files to create your own environment files:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Setting Up on DigitalOcean

1. Clone the repository
2. Create the necessary environment files as described above
3. Update the environment variables with your production values
4. Run `docker-compose up -d` 