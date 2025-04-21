#!/bin/bash

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying Acta AI to production...${NC}"

# Add all changes to git
git add .
git commit -m "Fix nginx configuration and backend settings validation errors"

# Push to the main branch
git push origin main

# SSH into the server and pull the latest changes
echo -e "${YELLOW}Connecting to the server and deploying...${NC}"
ssh -i ~/.ssh/id_ed25519 root@24.144.116.59 "cd /root/acta-ai && git pull && docker-compose down && docker-compose up -d --build"

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${YELLOW}Please check the status of the containers with:${NC}"
echo -e "ssh root@24.144.116.59 'docker ps'"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker is not installed. Please install Docker before continuing.${NC}"
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Docker Compose is not installed. Please install Docker Compose before continuing.${NC}"
  exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
  echo -e "${YELLOW}No .env file found. Creating a template .env file.${NC}"
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
  echo -e "${GREEN}.env file created. Please update it with your actual values before continuing.${NC}"
  exit 1
fi

# Check for SSL certificates
if [ ! -d "nginx/ssl" ]; then
  echo -e "${GREEN}Creating directory for SSL certificates${NC}"
  mkdir -p nginx/ssl
  echo -e "${YELLOW}SSL certificates not found. Please place your SSL certificates in the nginx/ssl directory:${NC}"
  echo -e "  - nginx/ssl/acta-ai.crt"
  echo -e "  - nginx/ssl/acta-ai.key${NC}"
  exit 1
fi

# Wait for the backend to be ready
echo -e "${GREEN}Waiting for backend to be ready...${NC}"
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
  echo -e "${GREEN}Backend is up and running!${NC}"
else
  echo -e "${RED}Backend didn't come up within the expected time.${NC}"
  echo -e "${RED}Check the logs with: docker-compose logs backend${NC}"
  exit 1
fi

# Check for database initialization flag
if [ ! -f ".db_initialized" ]; then
  echo -e "${GREEN}First-time setup detected. Initializing database...${NC}"
  docker-compose exec -T backend python -m app.initialize_db
  touch .db_initialized
else
  echo -e "${GREEN}Database already initialized. Skipping initialization.${NC}"
fi

# Run database migrations
echo -e "${GREEN}Running database migrations...${NC}"
docker-compose exec -T backend alembic upgrade head

echo -e "${GREEN}Acta AI has been successfully deployed!${NC}"
echo -e "${GREEN}Frontend: https://$DOMAIN_NAME${NC}"
echo -e "${GREEN}Backend API: https://$DOMAIN_NAME/api${NC}"

echo -e "${GREEN}To view logs:${NC}"
echo -e "docker-compose logs -f${NC}"
echo -e "To restart services:${NC}"
echo -e "docker-compose restart${NC}"
echo -e "To stop services:${NC}"
echo -e "docker-compose down${NC}"

# Display any potential warnings or notes
source .env
if [ "$OPENAI_API_KEY" = "your-openai-api-key" ]; then
  echo -e "${YELLOW}The OpenAI API key has not been set. Update it in the .env file.${NC}"
fi

if [ "$SECRET_KEY" = "change_this_to_a_random_string" ]; then
  echo -e "${YELLOW}The SECRET_KEY has not been changed from the default value. Update it in the .env file.${NC}"
fi

if [ "$DOMAIN_NAME" = "acta-ai.yourdomain.com" ]; then
  echo -e "${YELLOW}The DOMAIN_NAME is still set to the default. Update it in the .env file to match your actual domain.${NC}"
fi 