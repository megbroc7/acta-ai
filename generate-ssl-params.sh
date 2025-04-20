#!/bin/bash

# Script to generate secure DH parameters for SSL
# This improves the security of the SSL/TLS handshake

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Generating DH parameters for improved SSL security${NC}"
echo "This may take a few minutes..."

# Create directory if it doesn't exist
mkdir -p nginx/ssl

# Generate DH parameters
openssl dhparam -out nginx/ssl/dhparam.pem 2048

echo -e "${GREEN}DH parameters generated successfully!${NC}"
echo -e "File created at: ${YELLOW}nginx/ssl/dhparam.pem${NC}"
echo "This file will be used by Nginx to enhance the security of SSL connections." 