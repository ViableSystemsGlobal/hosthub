#!/bin/bash

# Post-Deployment Script for EasyPanel
# This script runs after deployment to set up cron jobs automatically
# Add this as a "Post Deploy Command" in EasyPanel

set -e

echo "🚀 Running post-deployment setup..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy || echo "⚠️  Migration failed or already up to date"

# Generate Prisma client (if needed)
echo "🔧 Generating Prisma client..."
npx prisma generate || echo "⚠️  Prisma generate failed"

# Set up cron jobs
echo "⏰ Setting up cron jobs..."
if [ -f "scripts/setup-cron.sh" ]; then
    bash scripts/setup-cron.sh || echo "⚠️  Cron setup failed (may need manual setup)"
else
    node scripts/setup-cron.js || echo "⚠️  Cron setup failed (may need manual setup)"
fi

echo "✅ Post-deployment setup complete!"
