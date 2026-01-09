# Automatic Cron Job Setup

This guide explains how to automatically set up cron jobs when deploying to EasyPanel/Hostinger VPS.

## Quick Setup (Recommended)

### Option 1: Admin UI (Easiest - No SSH Required!)

1. Go to **Settings** → **Diagnostics** tab
2. Scroll down to **"Cron Jobs Setup"** section
3. Click **"Set Up Cron Jobs"** button
4. Wait for setup to complete

**That's it!** The system will automatically set up cron jobs for you. If automatic setup fails, it will show you manual instructions.

### Option 2: EasyPanel Post-Deploy Command (Automatic)

1. Go to your EasyPanel dashboard
2. Navigate to your application → **Settings**
3. Find **"Post Deploy Command"** or **"Startup Script"**
4. Add this command:

```bash
bash scripts/post-deploy.sh
```

Or if that doesn't work, use:

```bash
node scripts/setup-cron.js
```

5. Save and redeploy

**That's it!** Cron jobs will be automatically set up every time you deploy.

### Option 3: Manual Setup (One-Time)

If you prefer to set it up manually once:

```bash
# SSH into your server
ssh user@your-server

# Navigate to your app directory
cd /path/to/your/app

# Run the setup script
npm run setup:cron

# Or directly:
node scripts/setup-cron.js
```

## How It Works

The setup script (`scripts/setup-cron.js` or `scripts/setup-cron.sh`):

1. ✅ Checks for required environment variables (`CRON_SECRET`, `NEXT_PUBLIC_APP_URL`)
2. ✅ Removes old HostHub cron jobs (to avoid duplicates)
3. ✅ Adds new cron jobs with correct URLs and secrets
4. ✅ Logs output to `/tmp/hosthub-*.log` for debugging

## Required Environment Variables

Make sure these are set in EasyPanel → Environment Variables:

- `CRON_SECRET` - A secret token for authenticating cron requests
- `NEXT_PUBLIC_APP_URL` - Your production domain (e.g., `https://yourdomain.com`)

## Installed Cron Jobs

After setup, these cron jobs will run automatically:

| Job | Schedule | Endpoint |
|-----|----------|----------|
| AI Reports | Every hour | `/api/ai-reports/execute` |
| Reminders | Every hour | `/api/reminders/run` |
| Recurring Tasks | Daily at midnight | `/api/recurring-tasks/generate` |
| Reports | Every hour | `/api/reports/execute` |

## Verify Cron Jobs Are Running

### Check if cron jobs are installed:

```bash
crontab -l | grep HostHub
```

You should see 4 entries.

### Check cron job logs:

```bash
# View all logs
tail -f /tmp/hosthub-*.log

# View specific log
tail -f /tmp/hosthub-ai-reports.log
```

### Test manually:

```bash
curl -X GET "https://yourdomain.com/api/ai-reports/execute" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Troubleshooting

### Cron jobs not running after deployment

1. **Check if cron service is running:**
   ```bash
   systemctl status cron
   # or
   systemctl status crond
   ```

2. **Check if cron jobs are installed:**
   ```bash
   crontab -l
   ```

3. **Check cron logs:**
   ```bash
   grep CRON /var/log/syslog
   # or
   tail -f /var/log/cron
   ```

4. **Verify environment variables:**
   ```bash
   echo $CRON_SECRET
   echo $NEXT_PUBLIC_APP_URL
   ```

5. **Run setup manually:**
   ```bash
   npm run setup:cron
   ```

### Cron jobs running but failing

1. **Check application logs in EasyPanel**
2. **Verify `CRON_SECRET` matches in environment variables**
3. **Test endpoint manually with curl**
4. **Check if your domain is accessible from the server**

### Permission issues

If you get permission errors:

```bash
# Make scripts executable
chmod +x scripts/setup-cron.sh
chmod +x scripts/post-deploy.sh
chmod +x scripts/setup-cron.js
```

## Updating Cron Jobs

If you need to update cron jobs (e.g., change schedule or add new ones):

1. Update the scripts in `scripts/setup-cron.js` or `scripts/setup-cron.sh`
2. Redeploy (if using Option 1) or run `npm run setup:cron` manually

The script automatically removes old entries before adding new ones, so you won't get duplicates.

## Manual Cron Management

If you prefer to manage cron jobs manually:

```bash
# Edit crontab
crontab -e

# View current crontab
crontab -l

# Remove all HostHub cron jobs
crontab -l | grep -v HostHub | crontab -
```

## Security Notes

- ✅ `CRON_SECRET` is required to authenticate cron requests
- ✅ All cron endpoints check for this secret before executing
- ✅ Cron jobs log to `/tmp/` which is cleaned on reboot
- ✅ Use HTTPS for all cron requests

## Next Steps

1. ✅ Set `CRON_SECRET` and `NEXT_PUBLIC_APP_URL` in EasyPanel
2. ✅ Add post-deploy command in EasyPanel (Option 1) or run manually (Option 2)
3. ✅ Deploy your application
4. ✅ Verify cron jobs are installed: `crontab -l`
5. ✅ Monitor logs: `tail -f /tmp/hosthub-*.log`
6. ✅ Test manually using the Diagnostics tab in Settings

---

**Need Help?** Check the main `CRON_SETUP.md` file for more detailed troubleshooting.
