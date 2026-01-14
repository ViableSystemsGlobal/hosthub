#!/bin/sh
set -e

echo "Starting application..."

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  # Try npx first, fallback to direct path
  npx prisma migrate deploy 2>/dev/null || ./node_modules/.bin/prisma migrate deploy || echo "Migrations failed or already applied"
else
  echo "WARNING: DATABASE_URL not set, skipping migrations"
fi

# Start the server
echo "Starting server on port ${PORT:-10000}..."
exec node server.js
