#!/usr/bin/env node

/**
 * Automated Cron Job Setup Script (Node.js version)
 * This script sets up cron jobs for HostHub automatically during deployment
 * Can be run as part of npm scripts or deployment process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CRON_SECRET = process.env.CRON_SECRET;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

if (!CRON_SECRET) {
  console.error('❌ Error: CRON_SECRET environment variable is not set');
  console.error('Please set CRON_SECRET in your EasyPanel environment variables');
  process.exit(1);
}

if (!NEXT_PUBLIC_APP_URL) {
  console.error('❌ Error: NEXT_PUBLIC_APP_URL environment variable is not set');
  process.exit(1);
}

// Remove protocol if present
let domain = NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const fullUrl = `https://${domain}`;

console.log('🔧 Setting up HostHub cron jobs...');
console.log(`📍 Domain: ${fullUrl}`);

try {
  // Get existing crontab
  let existingCron = '';
  try {
    existingCron = execSync('crontab -l', { encoding: 'utf-8' });
  } catch (e) {
    // No existing crontab, that's fine
  }

  // Filter out old HostHub cron jobs
  const filteredCron = existingCron
    .split('\n')
    .filter(line => 
      !line.includes('HostHub') &&
      !line.includes('api/ai-reports/execute') &&
      !line.includes('api/reminders/run') &&
      !line.includes('api/recurring-tasks/generate') &&
      !line.includes('api/reports/execute')
    )
    .join('\n')
    .trim();

  // Create new cron entries
  const newCronJobs = `
# HostHub Cron Jobs - Auto-generated on ${new Date().toISOString()}
# AI Reports (every hour)
0 * * * * curl -X GET "${fullUrl}/api/ai-reports/execute" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-ai-reports.log 2>&1 || true

# Reminders (every hour)
0 * * * * curl -X GET "${fullUrl}/api/reminders/run" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-reminders.log 2>&1 || true

# Recurring Tasks (daily at midnight)
0 0 * * * curl -X GET "${fullUrl}/api/recurring-tasks/generate" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-recurring-tasks.log 2>&1 || true

# Reports (every hour)
0 * * * * curl -X GET "${fullUrl}/api/reports/execute" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null -w "%{http_code}" > /tmp/hosthub-reports.log 2>&1 || true
`.trim();

  // Combine filtered cron with new jobs
  const finalCron = filteredCron ? `${filteredCron}\n${newCronJobs}` : newCronJobs;

  // Write to temporary file
  const tempFile = '/tmp/hosthub-crontab.txt';
  fs.writeFileSync(tempFile, finalCron + '\n');

  // Install new crontab
  execSync(`crontab ${tempFile}`, { stdio: 'inherit' });

  // Clean up
  fs.unlinkSync(tempFile);

  console.log('✅ Cron jobs installed successfully!');
  console.log('');
  console.log('Installed cron jobs:');
  console.log('  - AI Reports: Every hour at :00');
  console.log('  - Reminders: Every hour at :00');
  console.log('  - Recurring Tasks: Daily at midnight');
  console.log('  - Reports: Every hour at :00');
  console.log('');
  console.log('To verify, run: crontab -l');
  console.log('To check logs, run: tail -f /tmp/hosthub-*.log');

} catch (error) {
  console.error('❌ Error setting up cron jobs:', error.message);
  process.exit(1);
}
