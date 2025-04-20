#!/bin/bash
# Exit on error
set -e

echo "Starting migration for days_of_week column..."

# Change to backend directory
cd "$(dirname "$0")/backend"

# Activate virtual environment
source venv/bin/activate

# Add the column manually to ensure it exists with the correct type
echo "Executing SQL to add days_of_week column..."
psql postgresql://postgres:password@localhost:5432/actaai -c "ALTER TABLE blog_schedules ADD COLUMN IF NOT EXISTS days_of_week JSONB;"

# Update any existing records to have the new column with proper array values
echo "Updating existing records..."
psql postgresql://postgres:password@localhost:5432/actaai -c "UPDATE blog_schedules SET days_of_week = jsonb_build_array(day_of_week) WHERE days_of_week IS NULL AND day_of_week IS NOT NULL;"

echo "Migration completed successfully!"

# Return to the root directory
cd ..

# Restart application
./setup-and-start.sh

echo "Done!"

# Run the migration
echo "Running migration to add execution_history table..."
python -m alembic upgrade add_execution_history

echo "Migration completed." 