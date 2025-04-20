#!/bin/bash

# Frontend setup script for Acta AI
echo "Setting up Node.js environment for Acta AI frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js first."
    echo "Visit https://nodejs.org/ for installation instructions."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm first."
    echo "It usually comes with Node.js installation."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
cd frontend
npm install

# Install additional dependencies
echo "Installing additional dependencies..."
npm install jwt-decode
npm install --save-dev eslint eslint-plugin-react

echo "Frontend setup complete!"
echo "You can now run the frontend with: cd frontend && npm start" 