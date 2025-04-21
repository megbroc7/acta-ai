#!/bin/bash

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying Acta AI fixes to production...${NC}"

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