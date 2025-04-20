# Acta AI Production Deployment Guide

This document provides a comprehensive guide for deploying the Acta AI application to a production environment.

## Prerequisites

- A Linux server with Docker and Docker Compose installed
- Domain name configured to point to your server
- SSL certificate for your domain
- OpenAI API key

## Production Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/your-organization/acta-ai.git
cd acta-ai
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```
# Security
SECRET_KEY=your-secure-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Domain configuration
DOMAIN_NAME=acta-ai.yourdomain.com
```

### 3. Security Testing

Before deploying to production, you should conduct thorough security testing:

```bash
# Run the automated security test script
./security-test.sh

# Generate secure DH parameters for SSL
./generate-ssl-params.sh
```

For comprehensive security testing, follow the steps in `SECURITY_TESTING.md`, which includes:

- Testing authentication and authorization mechanisms
- Scanning for dependency vulnerabilities
- Running comprehensive OWASP Top 10 checks
- Verifying SSL/TLS configuration
- Testing for data validation issues
- Checking security headers

**Note:** Address all critical and high-severity security issues before proceeding with production deployment.

### 4. Setting Up Monitoring and Logging

A proper monitoring and logging infrastructure is crucial for a production environment to track application health, performance, and issues.

```bash
# Set up the monitoring stack
./setup-monitoring.sh
```

This will:
- Start Prometheus for metrics collection
- Set up Grafana for visualization
- Configure Loki for log aggregation
- Set up alerting for critical issues

After setup:
1. Access Grafana at `http://your-server-ip:3000` (default credentials: admin/secure_password)
2. Review the pre-configured dashboards for application metrics
3. Configure alert notifications according to your requirements
4. Verify log collection is working correctly

For detailed information on the monitoring stack, refer to `MONITORING.md`, which includes:
- Complete dashboard configurations
- Log query examples
- Alerting setup instructions
- Troubleshooting guidance

### 5. SSL Certificate Setup

Place your SSL certificates in the `nginx/ssl/` directory:

```bash
mkdir -p nginx/ssl
# Copy your SSL certificates
cp /path/to/your/certificate.crt nginx/ssl/acta-ai.crt
cp /path/to/your/private.key nginx/ssl/acta-ai.key
```

### 6. Update Configuration Files

1. Update `nginx/nginx.conf` with your actual domain name
2. Update `docker-compose.yml` with any environment-specific settings

### 7. Port Conflict Management

Acta AI uses several ports for its services:
- Frontend: Port 80 (HTTP) and 443 (HTTPS)
- Backend API: Port 8000
- Database: Port 5432

In production environments, you have two options for handling port conflicts:

#### Option 1: Use the Automatic Port Management Script

For development or testing environments, you can use our automatic port detection script:

```bash
./start-services.sh
```

This script:
- Checks if the default ports are in use
- Automatically selects alternative ports if needed
- Creates a `docker-compose.override.yml` file with the selected ports
- Updates the `.env` file with the correct configuration
- Starts all services with the appropriate port mappings

#### Option 2: Configure Nginx as a Reverse Proxy (Recommended for Production)

For production environments, we recommend using Nginx as a reverse proxy:

1. Ensure ports 80 and 443 are available on your server
2. Use our provided `nginx/nginx.conf` configuration
3. Let Nginx handle all external traffic and route it internally

This approach:
- Exposes only standard web ports (80/443) to the internet
- Uses Docker's internal networking for service-to-service communication
- Prevents direct access to backend services
- Eliminates port conflicts between applications

### 8. Build and Deploy

```bash
# Build and start all services
docker-compose up -d --build

# Initialize the database (first time only)
docker-compose exec backend python -m app.initialize_db
```

### 9. Verify Deployment

- Frontend: https://acta-ai.yourdomain.com
- Backend API: https://acta-ai.yourdomain.com/api/health

## Monitoring and Maintenance

### Health Checks

The backend service includes a health check endpoint at `/api/health` that returns a JSON response:

```json
{
  "status": "ok",
  "timestamp": "2025-03-13T16:51:21.716073",
  "api_version": "v1"
}
```

### Monitoring Infrastructure

The Acta AI application includes a comprehensive monitoring stack:

1. **Grafana Dashboards** (http://your-server-ip:3000)
   - Application health and performance metrics
   - System resource utilization
   - Database performance
   - HTTP request statistics
   - Error tracking

2. **Prometheus** (http://your-server-ip:9090)
   - Raw metrics collection and querying
   - Alert rule management
   - Targets status monitoring

3. **Loki** (integrated with Grafana)
   - Centralized log management
   - Log search and filtering
   - Log correlation with metrics

To view specific metrics:
```bash
# Check if monitoring services are running
cd monitoring && docker-compose -f docker-compose.monitoring.yml ps

# Restart monitoring services if needed
docker-compose -f docker-compose.monitoring.yml restart
```

For more details, refer to the `MONITORING.md` documentation.

### Logs

Logs are aggregated and available in several ways:

1. **Through Grafana**:
   - Access Grafana at http://your-server-ip:3000
   - Navigate to the "Explore" section
   - Select "Loki" data source
   - Query logs using labels (e.g., `{job="backend"}`)

2. **Through Docker**:
```bash
# View backend logs
docker-compose logs -f backend

# View frontend logs
docker-compose logs -f frontend

# View nginx logs
docker-compose logs -f nginx
```

3. **Direct file access**:
   - Backend logs: `/var/log/acta-ai/app.log`, `/var/log/acta-ai/error.log`
   - Frontend logs: `/var/log/acta-ai/frontend.log`
   - Nginx logs: `/var/log/acta-ai/access.log`

### Security Monitoring

Regularly monitor for security issues:

```bash
# Run security tests weekly
./security-test.sh

# Update dependencies and scan for vulnerabilities monthly
cd backend && pip install -U -r requirements.txt && safety check
cd frontend && npm update && npm audit
```

Set up proactive security monitoring:

1. **Configure Alerts in Grafana**:
   - Set up alerts for suspicious activities
   - Monitor for authentication failures
   - Track API rate limit violations
   - Generate notifications for unusual patterns

2. **Use Loki for Security Log Analysis**:
   - Create dashboards for security-related logs
   - Set up queries to detect brute force attempts
   - Monitor for unauthorized access attempts
   - Track API usage patterns

3. **Implement Runtime Security Checks**:
   - Configure alerts for unusual resource usage
   - Monitor network traffic patterns
   - Set up notifications for configuration changes
   - Track unexpected process activity

For detailed security monitoring configuration, refer to the "Alerting Configuration" section in `MONITORING.md`.

### Backups

Set up automated database backups:

```bash
# Create a backup script
cat > backup_db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
mkdir -p $BACKUP_DIR
docker-compose exec -T db pg_dump -U postgres acta_ai > $BACKUP_DIR/acta_ai_$TIMESTAMP.sql
EOF

# Make it executable
chmod +x backup_db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup_db.sh") | crontab -
```

## Security Recommendations

1. **Regular Updates**: Keep all dependencies up to date
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

2. **Firewall Configuration**: Allow only necessary ports (80, 443)
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

3. **Rate Limiting**: Configure rate limiting in Nginx to prevent abuse

4. **API Key Rotation**: Regularly rotate API keys and secrets

5. **Monitoring and Alerting**: 
   - Set up alerts for suspicious activity in Grafana
   - Configure notification channels (email, Slack, PagerDuty)
   - Implement escalation policies for critical alerts
   - Create dashboards for security metrics visualization
   - Set up automated reports for security events

6. **Log Retention and Analysis**:
   - Configure appropriate log retention periods
   - Implement log rotation to manage disk space
   - Use log queries to detect potential security incidents
   - Archive logs for compliance and audit purposes
   - Implement structured logging for better analysis

7. **Performance Monitoring**:
   - Track response times and set thresholds for alerts
   - Monitor resource utilization trends
   - Set up capacity planning dashboards
   - Track user experience metrics
   - Implement synthetic monitoring for critical paths

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Check if the database service is running: `docker-compose ps db`
   - Verify database credentials in environment variables

2. **API connectivity issues**:
   - Check if the backend service is running: `docker-compose ps backend`
   - Verify API responses: `curl -I https://acta-ai.yourdomain.com/api/health`

3. **Frontend loading issues**:
   - Check Nginx configuration for proper routing
   - Verify build process completed successfully: `docker-compose logs frontend`

4. **Security issues**:
   - Run the security test script: `./security-test.sh`
   - Check Nginx logs for suspicious activity: `docker-compose logs nginx | grep "denied"`

5. **Monitoring stack issues**:
   - Check if all monitoring services are running: `cd monitoring && docker-compose -f docker-compose.monitoring.yml ps`
   - Verify Prometheus can reach targets: `curl http://localhost:9090/api/v1/targets`
   - Check Grafana data sources: Access Grafana > Configuration > Data Sources
   - Verify log collection: `curl http://localhost:3100/ready` (for Loki)
   - Restart monitoring services if needed: `docker-compose -f docker-compose.monitoring.yml restart`

6. **Alerting issues**:
   - Verify alert rules in Prometheus: `curl http://localhost:9090/api/v1/rules`
   - Check notification channels in Grafana
   - Test alerts manually in Grafana UI
   - Verify SMTP settings for email notifications

### Recovering from Failures

// ... existing code ... 