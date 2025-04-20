#!/bin/bash

# Acta AI Production Deployment Script
# This script automates the deployment process for the Acta AI application

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colorful messages
print_message() {
  echo -e "${GREEN}[Acta AI Deploy]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[Warning]${NC} $1"
}

print_error() {
  echo -e "${RED}[Error]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  print_error "Docker is not installed. Please install Docker before continuing."
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  print_error "Docker Compose is not installed. Please install Docker Compose before continuing."
  exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
  print_warning "No .env file found. Creating a template .env file."
  cat > .env << EOF
# Security
SECRET_KEY=change_this_to_a_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Domain configuration
DOMAIN_NAME=acta-ai.yourdomain.com
EOF
  print_message ".env file created. Please update it with your actual values before continuing."
  exit 1
fi

# Check for SSL certificates
if [ ! -d "nginx/ssl" ]; then
  print_message "Creating directory for SSL certificates"
  mkdir -p nginx/ssl
  print_warning "SSL certificates not found. Please place your SSL certificates in the nginx/ssl directory:"
  print_warning "  - nginx/ssl/acta-ai.crt"
  print_warning "  - nginx/ssl/acta-ai.key"
  exit 1
fi

# Stop any running containers
print_message "Stopping any running containers..."
docker-compose down

# Pull latest code from repository
print_message "Pulling latest code from repository..."
git pull

# Build the containers
print_message "Building Docker containers..."
docker-compose build

# Start the services
print_message "Starting services..."
docker-compose up -d

# Wait for the backend to be ready
print_message "Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/api/health > /dev/null; then
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

# Check if backend is responding
if curl -s http://localhost:8000/api/health > /dev/null; then
  print_message "Backend is up and running!"
else
  print_error "Backend didn't come up within the expected time."
  print_error "Check the logs with: docker-compose logs backend"
  exit 1
fi

# Check for database initialization flag
if [ ! -f ".db_initialized" ]; then
  print_message "First-time setup detected. Initializing database..."
  docker-compose exec -T backend python -m app.initialize_db
  touch .db_initialized
else
  print_message "Database already initialized. Skipping initialization."
fi

# Run database migrations
print_message "Running database migrations..."
docker-compose exec -T backend alembic upgrade head

print_message "Acta AI has been successfully deployed!"
print_message "Frontend: https://$DOMAIN_NAME"
print_message "Backend API: https://$DOMAIN_NAME/api"

print_message "To view logs:"
print_message "  docker-compose logs -f"
print_message "To restart services:"
print_message "  docker-compose restart"
print_message "To stop services:"
print_message "  docker-compose down"

# Display any potential warnings or notes
source .env
if [ "$OPENAI_API_KEY" = "your-openai-api-key" ]; then
  print_warning "The OpenAI API key has not been set. Update it in the .env file."
fi

if [ "$SECRET_KEY" = "change_this_to_a_random_string" ]; then
  print_warning "The SECRET_KEY has not been changed from the default value. Update it in the .env file."
fi

if [ "$DOMAIN_NAME" = "acta-ai.yourdomain.com" ]; then
  print_warning "The DOMAIN_NAME is still set to the default. Update it in the .env file to match your actual domain."
fi 