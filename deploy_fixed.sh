#!/bin/bash
# Deployment script for Acta AI with fixes

# Exit on error
set -e

echo "Starting deployment process with fixes..."

# Stop and remove existing containers
echo "Stopping existing containers..."
docker-compose down

# Rebuild containers
echo "Rebuilding containers..."
docker-compose build --no-cache

# Start containers
echo "Starting containers..."
docker-compose up -d

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
sleep 10

# Create admin user
echo "Creating admin user..."
docker exec acta-ai-backend-1 python create_admin.py

echo "Deployment completed successfully!"
echo "Your application should now be running with the fixes applied."
echo ""
echo "You can now log in with:"
echo "  Email: admin@example.com"
echo "  Password: adminpassword"
echo ""
echo "Access the application at: http://24.144.116.59:3000/login" 