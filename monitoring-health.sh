#!/bin/bash

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Acta AI Monitoring Health Check ===${NC}"

# Function to check if a service is running
check_service() {
  local service_name=$1
  local port=$2
  local endpoint=${3:-""}
  local expected_status=${4:-200}
  
  echo -e "${YELLOW}Checking $service_name on port $port...${NC}"
  
  # Check if the port is open
  nc -z localhost $port > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ $service_name is not running (port $port is not open)${NC}"
    return 1
  fi
  
  # If an endpoint is specified, check if it responds correctly
  if [ -n "$endpoint" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port$endpoint)
    if [ "$HTTP_STATUS" -ne "$expected_status" ]; then
      echo -e "${RED}✗ $service_name endpoint $endpoint returned HTTP $HTTP_STATUS (expected $expected_status)${NC}"
      return 1
    fi
  fi
  
  echo -e "${GREEN}✓ $service_name is running correctly${NC}"
  return 0
}

# Function to check Docker container status
check_container() {
  local container_name=$1
  
  echo -e "${YELLOW}Checking container $container_name...${NC}"
  
  # Check if container exists and is running
  docker ps --filter "name=acta-ai-$container_name" --format "{{.Status}}" | grep -q "Up"
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Container acta-ai-$container_name is not running${NC}"
    return 1
  fi
  
  echo -e "${GREEN}✓ Container acta-ai-$container_name is running${NC}"
  return 0
}

# Check monitoring services
check_prometheus() {
  check_service "Prometheus" 9090 "/api/v1/status/config" 200
  return $?
}

check_grafana() {
  check_service "Grafana" 3000 "/api/health" 200
  return $?
}

check_loki() {
  check_service "Loki" 3100 "/ready" 200
  return $?
}

check_alertmanager() {
  check_service "Alertmanager" 9093 "/-/healthy" 200
  return $?
}

# Main health check logic
HEALTH_STATUS=0

# Check if Docker is running
echo -e "${YELLOW}Checking if Docker is running...${NC}"
docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Docker is not running${NC}"
  HEALTH_STATUS=1
else
  echo -e "${GREEN}✓ Docker is running${NC}"
  
  # Check individual containers
  check_container "prometheus" || HEALTH_STATUS=1
  check_container "grafana" || HEALTH_STATUS=1
  check_container "loki" || HEALTH_STATUS=1
  check_container "alertmanager" || HEALTH_STATUS=1
  check_container "promtail" || HEALTH_STATUS=1
  check_container "node-exporter" || HEALTH_STATUS=1
  check_container "cadvisor" || HEALTH_STATUS=1
  
  # Check service endpoints
  check_prometheus || HEALTH_STATUS=1
  check_grafana || HEALTH_STATUS=1
  check_loki || HEALTH_STATUS=1
  check_alertmanager || HEALTH_STATUS=1
fi

echo -e "${BLUE}=== Checking Log Files ===${NC}"
# Check if log directory exists and has proper permissions
if [ -d "/var/log/acta-ai" ]; then
  echo -e "${GREEN}✓ Log directory exists${NC}"
  
  # Check if log files are being written
  NEWEST_LOG=$(find /var/log/acta-ai -type f -name "*.log" -exec stat -c '%Y %n' {} \; | sort -nr | head -n 1 | cut -d' ' -f2)
  if [ -n "$NEWEST_LOG" ]; then
    LAST_MODIFIED=$(stat -c '%y' "$NEWEST_LOG")
    echo -e "${GREEN}✓ Most recent log file: $(basename "$NEWEST_LOG") (Last modified: $LAST_MODIFIED)${NC}"
  else
    echo -e "${YELLOW}! No log files found in /var/log/acta-ai${NC}"
    HEALTH_STATUS=1
  fi
else
  echo -e "${RED}✗ Log directory /var/log/acta-ai does not exist${NC}"
  HEALTH_STATUS=1
fi

echo -e "${BLUE}=== Health Check Summary ===${NC}"
if [ $HEALTH_STATUS -eq 0 ]; then
  echo -e "${GREEN}All monitoring services are healthy!${NC}"
else
  echo -e "${RED}Some monitoring services have issues. Please check the details above.${NC}"
fi

exit $HEALTH_STATUS 