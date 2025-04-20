#!/bin/bash
# Deployment script for Acta AI

echo "=== Starting deployment from GitHub ==="
cd /opt/acta-ai

# Create a backup of the current state
echo "Creating backup..."
mkdir -p .backups
cp -r frontend .backups/frontend-$(date +%Y%m%d-%H%M%S)

# Pull the latest code from GitHub
echo "Pulling latest code from GitHub..."
git pull origin main

# Make sure API paths match
if ! grep -q 'API_V1_STR: str = "/api/v1"' backend/app/core/config.py; then
  echo "Updating API path to include /v1..."
  sed -i 's/API_V1_STR: str = "\/api"/API_V1_STR: str = "\/api\/v1"/' backend/app/core/config.py
fi

# Rebuild and restart containers
echo "Rebuilding and restarting containers..."
docker-compose down
docker-compose up -d --build

echo "=== Deployment complete! ===" 