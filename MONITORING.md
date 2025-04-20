# Acta AI Monitoring and Logging Guide

This document provides a comprehensive guide to the monitoring and logging infrastructure set up for the Acta AI application.

## Table of Contents
1. [Monitoring Stack Overview](#monitoring-stack-overview)
2. [Setting Up Monitoring](#setting-up-monitoring)
3. [Available Dashboards](#available-dashboards)
4. [Log Management](#log-management)
5. [Alerting Configuration](#alerting-configuration)
6. [Metrics Collection](#metrics-collection)
7. [Troubleshooting](#troubleshooting)

## Monitoring Stack Overview

The Acta AI monitoring stack consists of the following components:

- **Prometheus**: Time-series database for metrics collection
- **Grafana**: Visualization and dashboarding platform
- **Loki**: Log aggregation system
- **Promtail**: Log collection agent
- **Node Exporter**: Host-level metrics
- **cAdvisor**: Container metrics
- **Postgres Exporter**: Database metrics
- **Nginx Exporter**: Nginx metrics

This infrastructure allows for comprehensive monitoring of:
- Application health and performance
- Infrastructure metrics (CPU, memory, disk)
- Request/response statistics
- Database performance
- Container resource usage
- Log aggregation and analysis

## Setting Up Monitoring

The monitoring stack can be set up using the provided script:

```bash
./setup-monitoring.sh
```

This script will:
1. Create the necessary directory structure
2. Set up log directories with appropriate permissions
3. Start the monitoring services using Docker Compose

Alternatively, you can start the monitoring stack manually:

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

## Available Dashboards

Once the monitoring stack is running, the following dashboards are available:

### Grafana (http://localhost:3000)
Default credentials: `admin / secure_password`

Pre-configured dashboards:
- **Acta AI Dashboard**: Main application dashboard with key metrics
- **System Overview**: Host-level metrics (CPU, memory, disk)
- **Postgres Performance**: Database metrics and queries
- **Nginx Metrics**: Web server performance and requests
- **Container Resources**: Docker container resource usage

### Prometheus (http://localhost:9090)
Direct access to metrics and query interface.

## Log Management

Logs are collected from various sources and centralized using Loki:

- **Application Logs**: Structured logs from backend and frontend
- **Access Logs**: HTTP requests and responses
- **Error Logs**: Application errors and exceptions
- **System Logs**: Operating system and service logs

### Log Locations

- **Backend Logs**: `/var/log/acta-ai/app.log`, `/var/log/acta-ai/error.log`
- **Frontend Logs**: `/var/log/acta-ai/frontend.log`
- **Nginx Logs**: `/var/log/acta-ai/access.log`

### Log Format

The application uses structured JSON logging with the following fields:
- `timestamp`: ISO-formatted timestamp
- `level`: Log level (INFO, ERROR, etc.)
- `message`: Log message
- `logger`: Name of the logger
- `request_id`: Unique request identifier
- `method`: HTTP method (for API logs)
- `path`: Request path (for API logs)
- `status_code`: HTTP status code (for API logs)
- `duration_ms`: Request duration in milliseconds

### Querying Logs in Grafana

Logs can be queried in Grafana using LogQL. Example queries:

```
{job="backend"} |= "error"
{job="nginx_access"} | json | status_code >= 400
{logger="app"} | json | duration_ms > 1000
```

## Alerting Configuration

Alerts are configured in Prometheus and sent to appropriate channels:

### Available Alert Rules

The following alert rules are preconfigured in `monitoring/rules/alert_rules.yml`:

- **ServiceDown**: Triggered when any service is down for more than 1 minute (critical severity)
- **APIHighLatency**: Triggered when API requests take more than 2 seconds for 5 minutes (warning severity)
- **HighErrorRate**: Triggered when 5xx errors exceed 5% of total requests for 2 minutes (warning severity)
- **HighCPUUsage**: Triggered when CPU usage is above 80% for 5 minutes (warning severity)
- **HighMemoryUsage**: Triggered when memory usage is above 85% for 5 minutes (warning severity)
- **DatabaseHighConnections**: Triggered when database connections exceed 20 for 5 minutes (warning severity)
- **LongRunningQueries**: Triggered when database transactions run for over 30 seconds (warning severity)
- **BackendHighMemoryUsage**: Triggered when the backend uses more than 500MB of memory (warning severity)
- **TooManyRequestsInProgress**: Triggered when more than 50 concurrent requests are in progress (warning severity)

### Configuring Alert Notification Channels

Alerts can be sent to various channels by configuring the Alertmanager in `monitoring/alertmanager/config.yml`:

1. **Email Notifications**:
   ```yaml
   receivers:
     - name: 'email-notifications'
       email_configs:
         - to: 'admin@acta-ai.com'
           send_resolved: true
   ```

2. **Slack Notifications**:
   ```yaml
   global:
     slack_api_url: 'https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK_URL'
   receivers:
     - name: 'slack-notifications'
       slack_configs:
         - channel: '#alerts'
           send_resolved: true
   ```

3. **PagerDuty Notifications**:
   ```yaml
   receivers:
     - name: 'pagerduty-notifications'
       pagerduty_configs:
         - service_key: YOUR_PAGERDUTY_SERVICE_KEY
           send_resolved: true
   ```

For more advanced configurations, refer to the [Alertmanager documentation](https://prometheus.io/docs/alerting/latest/configuration/).

## Frontend Logging

The frontend application has been configured with a structured logging system that sends logs to the backend for centralized aggregation:

### Frontend Logger Features

- **Log Levels**: Debug, Info, Warning, and Error levels
- **Structured Data**: All logs include rich contextual information
- **Batched Sending**: Logs are batched and sent to minimize network requests
- **Error Capture**: Automatic capture of unhandled exceptions and promise rejections
- **Session Tracking**: Logs include session and user identifiers

### Using the Frontend Logger

```javascript
import logger from '@/utils/logger';

// Initialize the logger
logger.init();

// Log different levels
logger.debug('Detailed debug information');
logger.info('User logged in', { userId: 123 });
logger.warn('Something might be wrong', { resourceId: 456 });
logger.error('Failed to load data', { error: err.message });

// Flush logs immediately (usually automatic)
logger.flush();
```

### Backend Log Handling

Frontend logs are sent to the `/api/logs` endpoint, where they are processed and routed to the appropriate log files using the same structured logging system as the backend.

## Monitoring Health Check

A monitoring health check script is provided to verify that all monitoring components are functioning correctly:

```bash
./monitoring-health.sh
```

This script checks:
- If all monitoring containers are running
- If all services are responding on their expected ports
- If log files are being written correctly
- Overall monitoring system health

Run this script regularly to ensure your monitoring system is functioning properly. It can be added to a cron job for automated health checks.

## Metrics Collection

The application collects various metrics:

### Application Metrics
- `http_requests_total`: Total number of HTTP requests
- `http_request_duration_seconds`: Request duration in seconds
- `http_requests_in_progress`: Number of in-flight requests
- `dependency_request_duration_seconds`: External dependency call duration

### Database Metrics
- `db_connection_pool_size`: Database connection pool size
- `db_connection_pool_used`: Active database connections
- `pg_stat_activity_count`: Number of active PostgreSQL connections
- `pg_stat_activity_max_tx_duration`: Maximum transaction duration

### System Metrics
- `process_memory_usage_bytes`: Application memory usage
- `process_cpu_usage_percent`: Application CPU usage
- `node_cpu_seconds_total`: Host CPU usage
- `node_memory_MemAvailable_bytes`: Host available memory

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Grafana**
   - Check if Prometheus is running: `docker-compose -f monitoring/docker-compose.monitoring.yml ps`
   - Verify data source configuration in Grafana
   - Check if the application metrics endpoint is accessible: `curl http://localhost:8000/api/metrics`

2. **Logs not appearing in Loki**
   - Check if Promtail is running and can access log files
   - Verify log paths in Promtail configuration
   - Check if log files exist with correct permissions

3. **Alerts not firing**
   - Check alert rules in Prometheus
   - Verify alert manager configuration
   - Test alerts manually in Grafana

### Restarting Services

To restart individual services:

```bash
docker-compose -f monitoring/docker-compose.monitoring.yml restart <service-name>
```

To restart the entire monitoring stack:

```bash
docker-compose -f monitoring/docker-compose.monitoring.yml down
docker-compose -f monitoring/docker-compose.monitoring.yml up -d
```

## Advanced Configuration

For advanced configuration options, refer to:

- Prometheus: `monitoring/prometheus.yml`
- Grafana dashboards: `monitoring/grafana/dashboards/`
- Grafana data sources: `monitoring/grafana/datasources/`
- Loki configuration: `monitoring/loki/local-config.yaml`
- Promtail configuration: `monitoring/promtail/config.yaml` 