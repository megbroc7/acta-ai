#!/bin/bash

# Acta AI Security Testing Script
# This script runs basic security tests against the Acta AI application

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colorful messages
print_header() {
  echo -e "\n${BLUE}==============================================${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}==============================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}[✓] $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}[!] $1${NC}"
}

print_error() {
  echo -e "${RED}[✗] $1${NC}"
}

print_info() {
  echo -e "[i] $1"
}

# Check if application is running
check_application() {
  print_header "Checking if Acta AI services are running"
  
  # Check backend
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health | grep "200\|404" > /dev/null; then
    print_success "Backend is running"
    BACKEND_RUNNING=true
  else
    print_warning "Backend does not appear to be running on port 8000"
    BACKEND_RUNNING=false
  fi
  
  # Check frontend
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep "200" > /dev/null; then
    print_success "Frontend is running"
    FRONTEND_RUNNING=true
  else
    print_warning "Frontend does not appear to be running on port 3000"
    FRONTEND_RUNNING=false
  fi
  
  if [ "$BACKEND_RUNNING" = false ] || [ "$FRONTEND_RUNNING" = false ]; then
    print_warning "Some services are not running. Start them with ./start-services.sh before running security tests"
  fi
}

# Test authentication endpoints
test_authentication() {
  print_header "Testing Authentication Endpoints"
  
  if [ "$BACKEND_RUNNING" = false ]; then
    print_warning "Skipping authentication tests as backend is not running"
    return
  fi
  
  # Test login with invalid credentials
  print_info "Testing login with invalid credentials..."
  RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"invalid@example.com","password":"invalidpassword"}')
  
  if echo "$RESPONSE" | grep -q "detail"; then
    print_success "Login correctly rejected invalid credentials"
  else
    print_error "Login endpoint did not properly handle invalid credentials"
  fi
  
  # Test login with SQL injection attempt
  print_info "Testing SQL injection protection..."
  RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin@example.com'\'' OR 1=1; --","password":"anything"}')
  
  if echo "$RESPONSE" | grep -q "detail"; then
    print_success "Login endpoint is protected against basic SQL injection"
  else
    print_error "Login endpoint may be vulnerable to SQL injection"
  fi
  
  # Test accessing protected endpoint without authentication
  print_info "Testing access to protected endpoints without authentication..."
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/templates)
  
  if [ "$RESPONSE" = "401" ]; then
    print_success "Protected endpoint correctly requires authentication"
  else
    print_error "Protected endpoint does not require authentication (returned $RESPONSE)"
  fi
}

# Test dependency vulnerabilities
test_dependencies() {
  print_header "Checking for Dependency Vulnerabilities"
  
  # Check if safety is installed
  if ! command -v safety &> /dev/null; then
    print_info "Installing Safety for Python dependency checking..."
    pip install safety
  fi
  
  # Check backend dependencies
  if [ -f "backend/requirements.txt" ]; then
    print_info "Scanning Python dependencies..."
    SAFETY_OUTPUT=$(safety check -r backend/requirements.txt 2>&1)
    
    if echo "$SAFETY_OUTPUT" | grep -q "No vulnerable packages found"; then
      print_success "No vulnerabilities found in backend dependencies"
    else
      print_error "Vulnerabilities found in backend dependencies:"
      echo "$SAFETY_OUTPUT" | grep -A 10 "Found"
    fi
  else
    print_warning "Backend requirements.txt not found"
  fi
  
  # Check frontend dependencies
  if [ -f "frontend/package.json" ]; then
    print_info "Checking if npm-audit-html is installed..."
    if ! command -v npm-audit-html &> /dev/null; then
      print_info "Installing npm-audit-html..."
      npm install -g npm-audit-html
    fi
    
    print_info "Scanning NPM dependencies..."
    cd frontend && npm audit --json > npm-audit.json 2>/dev/null || true
    
    if [ -s npm-audit.json ]; then
      VULNERABILITIES=$(cat npm-audit.json | grep -o '"vulnerabilities": {' | wc -l)
      
      if [ "$VULNERABILITIES" -gt 0 ]; then
        print_warning "Vulnerabilities found in frontend dependencies"
        npm-audit-html -o npm-audit-report.html
        print_info "Full report generated at frontend/npm-audit-report.html"
      else
        print_success "No vulnerabilities found in frontend dependencies"
      fi
    else
      print_warning "Could not generate npm audit report"
    fi
    cd ..
  else
    print_warning "Frontend package.json not found"
  fi
}

# Test for open ports
test_open_ports() {
  print_header "Checking for Exposed Ports"
  
  # Check if nmap is installed
  if ! command -v nmap &> /dev/null; then
    print_warning "nmap is not installed. Skipping port scan."
    print_info "Install nmap to run this check: sudo apt-get install nmap"
    return
  fi
  
  print_info "Scanning for exposed ports on localhost..."
  # Scan only expected ports to avoid a full port scan
  PORTS="3000,8000,5432,80,443"
  NMAP_OUTPUT=$(nmap -T4 -p $PORTS localhost)
  
  # Check each port
  for PORT in 3000 8000 5432; do
    if echo "$NMAP_OUTPUT" | grep -q "$PORT/tcp open"; then
      # Check if bound to localhost or all interfaces
      NETSTAT_OUTPUT=$(netstat -tuln | grep ":$PORT")
      if echo "$NETSTAT_OUTPUT" | grep -q "0.0.0.0:$PORT"; then
        print_warning "Port $PORT is exposed on all interfaces. Consider binding to localhost only."
      else
        print_success "Port $PORT is properly bound to localhost"
      fi
    else
      print_info "Port $PORT is not open"
    fi
  done
}

# Test for security headers
test_security_headers() {
  print_header "Checking Security Headers"
  
  if [ "$FRONTEND_RUNNING" = false ]; then
    print_warning "Skipping security header tests as frontend is not running"
    return
  fi
  
  print_info "Testing security headers on frontend..."
  CURL_OUTPUT=$(curl -s -I http://localhost:3000)
  
  # Test for basic security headers
  HEADERS_TO_CHECK=(
    "Strict-Transport-Security"
    "X-Content-Type-Options"
    "X-Frame-Options"
    "Content-Security-Policy"
    "X-XSS-Protection"
  )
  
  for HEADER in "${HEADERS_TO_CHECK[@]}"; do
    if echo "$CURL_OUTPUT" | grep -q "$HEADER"; then
      print_success "$HEADER header is set"
    else
      print_warning "$HEADER header is not set"
    fi
  done
}

# Main function
main() {
  echo "Acta AI Security Testing Script"
  echo "-------------------------------"
  
  check_application
  test_authentication
  test_dependencies
  test_open_ports
  test_security_headers
  
  print_header "Security Test Summary"
  print_info "Basic security tests completed."
  print_info "For comprehensive security testing, please refer to SECURITY_TESTING.md"
  print_info "Conduct thorough penetration testing before production deployment."
}

# Run main function
main 