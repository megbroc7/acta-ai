# Acta AI Deployment Guide

This guide provides instructions for deploying Acta AI on Digital Ocean.

## Prerequisites

- A Digital Ocean account
- Docker and Docker Compose installed on your local machine
- Git installed on your local machine

## Deployment Options

### Option 1: Deploy using Docker on a Droplet

1. **Create a Droplet**

   - Log in to your Digital Ocean account
   - Click "Create" and select "Droplets"
   - Choose the "Marketplace" tab and select "Docker"
   - Select a plan (Recommended: Basic plan with at least 2GB RAM)
   - Choose a datacenter region close to your users
   - Add your SSH key or create a password
   - Click "Create Droplet"

2. **Connect to your Droplet**

   ```bash
   ssh root@your_droplet_ip
   ```

3. **Clone the Repository**

   ```bash
   git clone https://github.com/your-username/acta-ai.git
   cd acta-ai
   ```

4. **Configure Environment Variables**

   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```

   Update the following variables:
   
   ```
   DATABASE_URL=postgresql://postgres:password@db:5432/actaai
   SECRET_KEY=your_secret_key
   OPENAI_API_KEY=your_openai_api_key
   CORS_ORIGINS=http://your_droplet_ip:3000
   ```

5. **Start the Application**

   ```bash
   docker-compose up -d
   ```

6. **Access the Application**

   - Backend API: `http://your_droplet_ip:8000`
   - Frontend: `http://your_droplet_ip:3000`
   - API Documentation: `http://your_droplet_ip:8000/docs`

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

## Maintenance

### Database Backups

To set up automated backups for your PostgreSQL database:

1. **Using Droplet Deployment**

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

2. **Using App Platform**

   - Database backups are handled automatically by Digital Ocean

### Updating the Application

1. **Using Droplet Deployment**

   ```bash
   cd /root/acta-ai
   git pull
   docker-compose down
   docker-compose up -d --build
   ```

2. **Using App Platform**

   - Push changes to your GitHub repository
   - Digital Ocean will automatically deploy the changes

## Monitoring

1. **Using Droplet Deployment**

   Install and configure monitoring tools:

   ```bash
   # Install Prometheus and Grafana
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Using App Platform**

   - Monitoring is provided by Digital Ocean

## Troubleshooting

### Common Issues

1. **Database Connection Issues**

   - Check the DATABASE_URL environment variable
   - Ensure the PostgreSQL service is running
   - Check firewall settings

2. **Application Not Starting**

   - Check the logs: `docker-compose logs backend`
   - Verify environment variables are set correctly
   - Ensure the OpenAI API key is valid

3. **Frontend Not Connecting to Backend**

   - Check CORS settings
   - Verify the frontend is configured to use the correct API URL

### Getting Help

If you encounter issues not covered in this guide, please:

1. Check the application logs
2. Consult the Digital Ocean documentation
3. Open an issue on the GitHub repository 