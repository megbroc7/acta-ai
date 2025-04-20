#!/bin/bash

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Setting up Acta AI Monitoring Environment ===${NC}"

# Create necessary directories
echo -e "${YELLOW}Creating directory structure...${NC}"
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources
mkdir -p monitoring/loki
mkdir -p monitoring/promtail
mkdir -p monitoring/rules
mkdir -p monitoring/alertmanager/templates
mkdir -p logs/acta-ai

# Make sure the log directory exists for the application
echo -e "${YELLOW}Creating log directories...${NC}"
sudo mkdir -p /var/log/acta-ai
sudo chmod 777 /var/log/acta-ai

# Starting the monitoring stack
echo -e "${YELLOW}Starting monitoring stack...${NC}"
cd monitoring && docker-compose -f docker-compose.monitoring.yml up -d

echo -e "${GREEN}Monitoring stack has been initialized!${NC}"
echo -e "${BLUE}=================================${NC}"
echo -e "Access Grafana at: ${GREEN}http://localhost:3000${NC}"
echo -e "Default credentials: ${YELLOW}admin / secure_password${NC}"
echo -e "Access Prometheus at: ${GREEN}http://localhost:9090${NC}"
echo -e "Access Alertmanager at: ${GREEN}http://localhost:9093${NC}"
echo -e "Access Loki at: ${GREEN}http://localhost:3100${NC}"
echo -e "${BLUE}=================================${NC}"

echo -e "${YELLOW}Running initial health check...${NC}"
../monitoring-health.sh

echo -e "${YELLOW}Note: It may take a few minutes for data to start appearing in Grafana.${NC}"
echo -e "${YELLOW}After logging in, go to Dashboards to view the Acta AI monitoring dashboard.${NC}" 