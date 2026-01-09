#!/bin/bash

# Automated Cron Job Setup Script
# This script sets up cron jobs for HostHub automatically during deployment
# Run this script after deployment or as part of your deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up HostHub cron jobs...${NC}"

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}Error: CRON_SECRET environment variable is not set${NC}"
    echo "Please set CRON_SECRET in your EasyPanel environment variables"
    exit 1
fi

# Check if NEXT_PUBLIC_APP_URL is set
if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_APP_URL environment variable is not set${NC}"
    exit 1
fi

DOMAIN="$NEXT_PUBLIC_APP_URL"
SECRET="$CRON_SECRET"

# Remove protocol if present
DOMAIN=$(echo "$DOMAIN" | sed 's|https\?://||' | sed 's|/$||')
FULL_URL="https://${DOMAIN}"

echo -e "${YELLOW}Domain: ${FULL_URL}${NC}"
echo -e "${YELLOW}Setting up cron jobs...${NC}"

# Create a temporary crontab file
TEMP_CRON=$(mktemp)

# Get existing crontab (if any) and filter out our old cron jobs
(crontab -l 2>/dev/null | grep -v "HostHub" | grep -v "api/ai-reports/execute" | grep -v "api/reminders/run" | grep -v "api/recurring-tasks/generate" | grep -v "api/reports/execute" || true) > "$TEMP_CRON"

# Add our cron jobs with HostHub comment
cat >> "$TEMP_CRON" << EOF

# HostHub Cron Jobs - Auto-generated on $(date)
# AI Reports (every hour)
0 * * * * curl -X GET "${FULL_URL}/api/ai-reports/execute" -H "Authorization: Bearer ${SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-ai-reports.log 2>&1 || true

# Reminders (every hour)
0 * * * * curl -X GET "${FULL_URL}/api/reminders/run" -H "Authorization: Bearer ${SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-reminders.log 2>&1 || true

# Recurring Tasks (daily at midnight)
0 0 * * * curl -X GET "${FULL_URL}/api/recurring-tasks/generate" -H "Authorization: Bearer ${SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-recurring-tasks.log 2>&1 || true

# Reports (every hour)
0 * * * * curl -X GET "${FULL_URL}/api/reports/execute" -H "Authorization: Bearer ${SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-reports.log 2>&1 || true
EOF

# Install the new crontab
crontab "$TEMP_CRON"

# Clean up
rm "$TEMP_CRON"

echo -e "${GREEN}✓ Cron jobs installed successfully!${NC}"
echo ""
echo "Installed cron jobs:"
echo "  - AI Reports: Every hour at :00"
echo "  - Reminders: Every hour at :00"
echo "  - Recurring Tasks: Daily at midnight"
echo "  - Reports: Every hour at :00"
echo ""
echo "To verify, run: crontab -l"
echo "To check logs, run: tail -f /tmp/hosthub-*.log"
