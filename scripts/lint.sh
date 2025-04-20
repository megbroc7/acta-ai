#!/bin/bash
# Script to run linting tools on the codebase

# Exit on error
set -e

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "Installing linting tools..."
pip install flake8 black isort

echo "Running flake8..."
flake8 backend --count --select=E9,F63,F7,F82 --show-source --statistics

echo "Running black..."
black --check backend

echo "Running isort..."
isort --check-only --profile black backend

echo "All linting checks passed!" 