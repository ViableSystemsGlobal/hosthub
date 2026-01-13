#!/bin/bash
set -e

echo "Starting application..."

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy || echo "Migrations failed or already applied"
else
  echo "WARNING: DATABASE_URL not set, skipping migrations"
fi

# Start the server
echo "Starting server on port ${PORT:-10000}..."
exec node server.js
