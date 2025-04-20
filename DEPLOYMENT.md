# Acta AI Deployment Guide

This guide explains how to deploy and update the Acta AI application, with specific instructions for Digital Ocean deployment.

## Current Production Environment

- IP Address: 24.144.116.59
- Hostname: acta-ai
- Region: NYC1
- Size: Basic (2GB RAM, 1 CPU)
- OS: Ubuntu 22.04 LTS

## Prerequisites

- Docker and Docker Compose
- Git
- Node.js (for local development)
- Python 3.11+ (for local development)
- A Digital Ocean account (if deploying to Digital Ocean)

## Environment Configuration

The application uses environment-specific configuration files located in:
- `config/environments/development/` - For development environment
- `config/environments/production/` - For production environment

### Required Environment Files

For each environment, you need:
1. `backend.env` - Backend environment variables
2. `frontend.env` - Frontend environment variables

## Digital Ocean Deployment

### Option 1: Deploy using Docker on a Droplet (Recommended)

1. **Connect to your Droplet**

   ```bash
   ssh root@24.144.116.59  # Replace with your droplet IP
   ```

2. **Clone the Repository**

   ```bash
   git clone https://github.com/your-username/acta-ai.git
   cd acta-ai
   ```

3. **Configure Environment Variables**

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp .env.example .env
   
   # Edit the environment files
   nano backend/.env
   nano frontend/.env
   nano .env
   ```

   Update the following variables:
   
   ```
   # In .env
   OPENAI_API_KEY=your-openai-api-key-here
   SECRET_KEY=your-secret-key-here
   
   # In backend/.env
   DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/acta_ai
   SECRET_KEY=your-secret-key-here
   OPENAI_API_KEY=your-openai-api-key-here
   CORS_ORIGINS=["https://your-domain.com", "http://localhost:3000"]
   
   # In frontend/.env
   REACT_APP_API_URL=http://your_droplet_ip:8000/api
   ```

4. **Start the Application**

   ```bash
   ./deploy.sh
   ```

   This script will:
   - Set the environment to production
   - Stop and remove existing containers
   - Build and start the containers
   - Create an admin user

5. **Access the Application**
   - Frontend: http://24.144.116.59:3000
   - Backend API: http://24.144.116.59:8000
   - API Documentation: http://24.144.116.59:8000/docs

6. **Default Credentials**
   - Email: admin@example.com
   - Password: adminpassword
   - **Important**: Change these credentials after first login

### Option 2: Deploy using App Platform

1. **Prepare your Repository**
   - Push your code to a GitHub repository
   - Make sure your repository includes the Dockerfile and docker-compose.yml

2. **Create an App**
   - Log in to your Digital Ocean account
   - Navigate to "Apps" and click "Create App"
   - Connect your GitHub repository
   - Select the branch you want to deploy
   - Configure the app:
     - For the backend, select the Dockerfile in the backend directory
     - For the frontend, select the Dockerfile in the frontend directory
   - Configure environment variables
   - Click "Next" and then "Create Resources"

3. **Configure Database**
   - In the App Platform dashboard, click "Create Component"
   - Select "Database"
   - Choose "PostgreSQL"
   - Select a plan
   - Click "Create and Attach"

4. **Update Environment Variables**
   - In the App Platform dashboard, navigate to your app
   - Click "Settings" and then "Environment Variables"
   - Add the required environment variables:
     - `DATABASE_URL`: Use the connection string from the database component
     - `SECRET_KEY`: A secure random string
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `CORS_ORIGINS`: The URL of your frontend app

5. **Deploy the App**
   - Click "Deploy" to deploy your app

## Updating the Application

To update the application with the latest code:

1. **SSH into the droplet**:
   ```bash
   ssh root@24.144.116.59
   ```

2. **Update the code**:
   ```bash
   cd acta-ai
   git pull
   ```

3. **Restart the application**:
   ```bash
   ./deploy.sh
   ```

## Troubleshooting

If you encounter issues during deployment:

1. **Check container logs**:
   ```bash
   docker-compose logs frontend
   docker-compose logs backend
   docker-compose logs db
   ```

2. **Ensure all containers are running**:
   ```bash
   docker-compose ps
   ```

3. **Restart the containers**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Check the environment files** exist and have correct values

5. **Verify Docker is running**:
   ```bash
   systemctl status docker
   ```

6. **If the database needs to be reset**:
   ```bash
   docker-compose down -v  # This will remove the volumes
   docker-compose up -d
   docker exec -it acta-ai-backend-1 python create_admin.py
   ```

## Backup and Restore

### Database Backup
```bash
docker exec acta-ai-db-1 pg_dump -U postgres actaai > backup.sql
```

### Database Restore
```bash
cat backup.sql | docker exec -i acta-ai-db-1 psql -U postgres actaai
```

## Security Considerations

1. The application is currently accessible via HTTP. For production use, consider setting up HTTPS with Let's Encrypt.
2. The default admin credentials should be changed after the first login.
3. Consider setting up a firewall to restrict access to only necessary ports.

## Monitoring

1. **Install and configure monitoring tools**:
   ```bash
   # Install Prometheus and Grafana
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Access monitoring dashboards**:
   - Grafana: http://your_droplet_ip:3000
   - Prometheus: http://your_droplet_ip:9090

## Automated Backups

To set up automated backups for your PostgreSQL database:

```bash
mkdir -p /root/backups

# Create a backup script
cat > /root/backup.sh << 'EOL'
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/root/backups"
CONTAINER_NAME="acta-ai_db_1"

docker exec $CONTAINER_NAME pg_dump -U postgres actaai > $BACKUP_DIR/actaai_$TIMESTAMP.sql

# Keep only the last 7 backups
ls -tp $BACKUP_DIR/*.sql | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {}
EOL

chmod +x /root/backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 0 * * * /root/backup.sh") | crontab -
``` 