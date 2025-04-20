#!/bin/bash

# Database setup script for Acta AI
echo "Setting up PostgreSQL database for Acta AI..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    echo "Visit https://www.postgresql.org/download/ for installation instructions."
    exit 1
fi

# Create database
echo "Creating database..."
psql -c "CREATE DATABASE actaai;" postgres || echo "Database may already exist, continuing..."

# Create user if not exists
echo "Creating user..."
psql -c "CREATE USER postgres WITH PASSWORD 'password';" postgres || echo "User may already exist, continuing..."

# Grant privileges
echo "Granting privileges..."
psql -c "GRANT ALL PRIVILEGES ON DATABASE actaai TO postgres;" postgres

echo "Database setup complete!"
echo "You can now run the backend with: cd backend && python -m uvicorn app.main:app --reload" 