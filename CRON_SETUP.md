# Cron Job Configuration for Production

## For EasyPanel / Hostinger VPS

Since you're using EasyPanel with Hostinger VPS, you'll need to set up cron jobs manually using the server's crontab.

### 1. Set Up CRON_SECRET (Security)

First, set a `CRON_SECRET` environment variable in your EasyPanel:

1. Go to your EasyPanel dashboard
2. Navigate to your application
3. Go to **Environment Variables**
4. Add a new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** Generate a strong random string (see below)
   - **Scope:** Production

**Generate a secret:**
```bash
openssl rand -hex 32
```

### 2. Set Up Server Cron Jobs

SSH into your VPS and set up cron jobs:

#### Option A: Using EasyPanel Terminal

1. Go to EasyPanel → Your App → Terminal
2. Run the following commands:

```bash
# Edit crontab
crontab -e

# Add these lines (replace YOUR_DOMAIN and YOUR_CRON_SECRET)
0 * * * * curl -X GET https://YOUR_DOMAIN.com/api/ai-reports/execute -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
0 * * * * curl -X GET https://YOUR_DOMAIN.com/api/reminders/run -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
0 0 * * * curl -X GET https://YOUR_DOMAIN.com/api/recurring-tasks/generate -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
0 * * * * curl -X GET https://YOUR_DOMAIN.com/api/reports/execute -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
```

#### Option B: Create Cron Script

Create a script file for easier management:

```bash
# Create scripts directory
mkdir -p /opt/hosthub/cron

# Create cron script
nano /opt/hosthub/cron/run-cron.sh
```

Add this content:
```bash
#!/bin/bash

DOMAIN="https://YOUR_DOMAIN.com"
SECRET="YOUR_CRON_SECRET"

# AI Reports (every hour)
curl -X GET "$DOMAIN/api/ai-reports/execute" \
  -H "Authorization: Bearer $SECRET" \
  -s -o /dev/null

# Reminders (every hour)
curl -X GET "$DOMAIN/api/reminders/run" \
  -H "Authorization: Bearer $SECRET" \
  -s -o /dev/null

# Recurring Tasks (daily at midnight)
if [ $(date +%H) -eq 0 ] && [ $(date +%M) -eq 0 ]; then
  curl -X GET "$DOMAIN/api/recurring-tasks/generate" \
    -H "Authorization: Bearer $SECRET" \
    -s -o /dev/null
fi

# Reports (every hour)
curl -X GET "$DOMAIN/api/reports/execute" \
  -H "Authorization: Bearer $SECRET" \
  -s -o /dev/null
```

Make it executable:
```bash
chmod +x /opt/hosthub/cron/run-cron.sh
```

Add to crontab:
```bash
crontab -e
# Add this line:
* * * * * /opt/hosthub/cron/run-cron.sh
```

### 3. Verify Cron Jobs Are Running

Check if cron jobs are executing:

```bash
# View cron logs
tail -f /var/log/cron

# Or check your application logs
# In EasyPanel, go to your app → Logs
```

### 4. Test the Cron Job

**Option A: Via Admin UI**
- Go to **Settings** → **Diagnostics** tab
- Click **"Test AI Reports Now"** button

**Option B: Via SSH**
```bash
curl -X GET https://YOUR_DOMAIN.com/api/ai-reports/execute \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Option C: Manual Test (Admin only)**
```bash
# Get your session token from browser, then:
curl -X POST https://YOUR_DOMAIN.com/api/ai-reports/execute \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Troubleshooting

**Cron job not running:**
- Check if cron service is running: `systemctl status cron` (or `crond` on some systems)
- Verify crontab entries: `crontab -l`
- Check cron logs: `grep CRON /var/log/syslog` or `/var/log/cron`

**Cron job running but failing:**
- Check application logs in EasyPanel
- Verify `CRON_SECRET` matches in environment variables
- Test endpoint manually with curl
- Check if your domain is accessible from the server

**Permission issues:**
- Ensure the cron user has permission to run curl
- Check file permissions on scripts: `chmod +x script.sh`

---

## For Vercel (Alternative)

If you switch to Vercel in the future, your `vercel.json` is already configured:

### 1. Automatic Setup (Vercel Pro/Enterprise)

If you're on Vercel Pro or Enterprise, cron jobs are automatically enabled when you deploy. The `vercel.json` file is automatically detected.

**Current Cron Jobs Configured:**
- `/api/ai-reports/execute` - Runs every hour (`0 * * * *`) - **For AI Reports**
- `/api/reminders/run` - Runs every hour (`0 * * * *`)
- `/api/recurring-tasks/generate` - Runs daily at midnight (`0 0 * * *`)
- `/api/reports/execute` - Runs every hour (`0 * * * *`)

### 2. Set Up CRON_SECRET (Security)

For security, set a `CRON_SECRET` environment variable:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** Generate a strong random string (e.g., use `openssl rand -hex 32`)
   - **Environment:** Production (and Preview if needed)

**Generate a secret:**
```bash
openssl rand -hex 32
```

### 3. Verify Cron Jobs Are Active

After deploying to production:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Cron Jobs**
3. You should see all 4 cron jobs listed
4. Check their status and last execution time

### 4. Test the Cron Job

You can manually test the AI reports cron job:

**Option A: Via Admin UI**
- Go to **Settings** → **Diagnostics** tab
- Click **"Test AI Reports Now"** button

**Option B: Via API (Admin only)**
```bash
curl -X POST https://your-domain.com/api/ai-reports/execute \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

**Option C: Direct call (if CRON_SECRET is set)**
```bash
curl -X GET https://your-domain.com/api/ai-reports/execute \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 5. Monitor Cron Job Execution

**In Vercel Dashboard:**
- Go to **Settings** → **Cron Jobs**
- View execution logs and history
- Check for any errors

**In Application Logs:**
- Go to **Deployments** → Select a deployment → **Functions** tab
- View logs for `/api/ai-reports/execute`

## For Other Hosting Providers

### Option 1: External Cron Service (Recommended)

Use a service like **cron-job.org** or **EasyCron**:

1. Sign up for a free account
2. Create a new cron job:
   - **URL:** `https://your-domain.com/api/ai-reports/execute`
   - **Schedule:** `0 * * * *` (every hour)
   - **Method:** GET
   - **Headers:** 
     - `Authorization: Bearer YOUR_CRON_SECRET`
3. Save and activate

### Option 2: Server Cron (If you have a server)

If you have a VPS or dedicated server, add to crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs every hour)
0 * * * * curl -X GET https://your-domain.com/api/ai-reports/execute -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 3: GitHub Actions (Free)

Create `.github/workflows/cron.yml`:

```yaml
name: AI Reports Cron

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger AI Reports
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/ai-reports/execute \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Schedule Format Reference

The cron schedule uses standard cron syntax:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

**Common Schedules:**
- `0 * * * *` - Every hour at minute 0
- `0 0 * * *` - Daily at midnight
- `0 8 * * *` - Daily at 8:00 AM
- `0 0 * * 1` - Every Monday at midnight
- `*/30 * * * *` - Every 30 minutes

## Troubleshooting

### Cron Job Not Running

1. **Check Vercel Plan:**
   - Cron jobs require Vercel Pro or Enterprise
   - Free/Hobby plans don't support cron jobs

2. **Check Environment Variables:**
   - Ensure `CRON_SECRET` is set in production
   - Redeploy after adding environment variables

3. **Check Logs:**
   - View function logs in Vercel dashboard
   - Check for authentication errors

4. **Verify Endpoint:**
   - Test the endpoint manually first
   - Ensure it returns 200 status

### Cron Job Running But Reports Not Sending

1. **Check Owner Preferences:**
   - Verify owners have AI reports enabled
   - Check frequency and time settings
   - Ensure owners have email addresses

2. **Check Email Configuration:**
   - Verify SMTP settings in Settings → Email
   - Test email sending manually

3. **Check AI Configuration:**
   - Verify AI API key is set
   - Check AI provider settings

## Current Configuration Summary

Your AI Reports cron job is configured to:
- **Run:** Every hour (`0 * * * *`)
- **Endpoint:** `/api/ai-reports/execute`
- **Action:** Checks all owners with AI reports enabled and sends reports to those who are due

The cron job will:
1. Find all owners with `aiReportEnabled: true`
2. Check if their `aiReportNextSend` time has passed
3. Generate and send AI reports via email
4. Update `aiReportLastSent` and calculate `aiReportNextSend`

## Next Steps

1. ✅ Deploy to production (Vercel automatically sets up crons)
2. ✅ Set `CRON_SECRET` environment variable
3. ✅ Verify cron jobs appear in Vercel dashboard
4. ✅ Test manually using the Diagnostics tab
5. ✅ Monitor first few executions
6. ✅ Check owner email inboxes for reports

