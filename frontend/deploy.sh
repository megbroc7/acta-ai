#!/bin/bash

# Frontend deployment script

# Exit on error
set -e

echo "Starting frontend deployment..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Build for production
echo "Building for production..."
npm run build

echo "Frontend build completed successfully!"

# If you want to add deployment to your server, you can add commands here
# For example, using scp to copy files to your Digital Ocean server:
# echo "Deploying to production server..."
# scp -r build/* user@24.144.116.59:/var/www/html/

echo "Deployment script completed!" 