#!/bin/bash
# Script to create an admin user in the Acta AI application

echo "Creating admin user..."
docker exec -it acta-ai-backend-1 python create_admin.py

echo "Admin user creation completed."
echo "You can now log in with:"
echo "  Email: admin@example.com"
echo "  Password: adminpassword" 