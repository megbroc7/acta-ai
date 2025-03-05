#!/bin/bash
# Deployment script for Acta AI

# Exit on error
set -e

echo "Starting deployment process..."

# Set environment to production
export ENV=production

# Check if production environment files exist
if [ ! -f "./config/environments/production/backend.env" ] || [ ! -f "./config/environments/production/frontend.env" ]; then
  echo "Error: Production environment files not found!"
  echo "Please create the following files:"
  echo "  - ./config/environments/production/backend.env"
  echo "  - ./config/environments/production/frontend.env"
  exit 1
fi

# Pull latest code
echo "Pulling latest code from repository..."
git fetch
git pull

echo "Building and starting containers..."
docker-compose build
docker-compose up -d

echo "Deployment completed successfully!"
echo "Your application should now be running with the latest code." 