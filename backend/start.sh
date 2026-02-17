#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -q; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Running database migrations..."
PYTHONPATH=. alembic upgrade head
echo "Migrations complete."

echo "Starting Acta AI backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
