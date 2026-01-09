# Production Deployment Guide - EasyPanel / Hostinger VPS

## Prerequisites

1. **EasyPanel installed** on your Hostinger VPS
2. **Node.js 20.9+** installed (check with `node -v`) - **Required for Prisma 7.1.0 and Next.js 16**
3. **PostgreSQL database** set up (can be on same server or remote)
4. **Domain name** pointing to your VPS (optional but recommended)

## Step 1: Prepare Your Code

### 1.1 Build the Project Locally (Optional but Recommended)

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Build the project
npm run build
```

### 1.2 Prepare Environment Variables

Create a `.env.production` file with all required variables:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-secret-key-here" # Generate with: openssl rand -base64 32

# App URL
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# SMTP (Hostinger)
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_USER="your-email@yourdomain.com"
SMTP_PASSWORD="your-email-password"
SMTP_FROM="your-email@yourdomain.com"

# Cron Secret (for scheduled tasks)
CRON_SECRET="your-cron-secret" # Generate with: openssl rand -hex 32

# AI Provider (choose one)
AI_PROVIDER="openai" # or "anthropic" or "gemini"
OPENAI_API_KEY="your-openai-key" # if using OpenAI
# ANTHROPIC_API_KEY="your-key" # if using Anthropic
# GEMINI_API_KEY="your-key" # if using Gemini

# Optional: SMS/WhatsApp
DEYWURO_USERNAME="your-username"
DEYWURO_PASSWORD="your-password"
TWILIO_ACCOUNT_SID="your-sid"
TWILIO_AUTH_TOKEN="your-token"
```

## Step 2: Deploy to EasyPanel

### 2.1 Upload Your Code

**Option A: Using Git (Recommended)**

1. Push your code to GitHub/GitLab/Bitbucket
2. In EasyPanel, create a new application
3. Connect your Git repository
4. EasyPanel will automatically pull and build

**Option B: Using File Manager**

1. Compress your project folder (excluding `node_modules`, `.next`, `.git`)
2. Upload via EasyPanel File Manager or SFTP
3. Extract in your application directory

### 2.2 Configure Application in EasyPanel

1. **Application Type:** Node.js
2. **Node Version:** 20.x or higher (**Required** - Prisma 7.1.0 requires Node 20.19+, Next.js 16 requires Node 20.9+)
3. **Build Command:** `npm ci --legacy-peer-deps && npx prisma generate && npm run build`
4. **Start Command:** `npm start`
5. **Port:** Auto-detect (usually 3000)
6. **Working Directory:** `/` (root of your app)

**Note:** The `nixpacks.toml` file in the repository will automatically configure Node.js 20 for EasyPanel/Nixpacks builds.

### 2.3 Set Environment Variables

In EasyPanel, go to your application → Environment Variables and add all variables from `.env.production`

**Important Variables:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_URL` - Your production domain
- `NEXTAUTH_SECRET` - Generate a new secret for production
- `NEXT_PUBLIC_APP_URL` - Your production domain
- `CRON_SECRET` - For cron job authentication

## Step 3: Database Setup

### 3.1 Run Migrations

SSH into your VPS or use EasyPanel terminal:

```bash
cd /path/to/your/app
npx prisma migrate deploy
```

Or if using Prisma migrations:

```bash
npx prisma migrate deploy
```

### 3.2 Generate Prisma Client

```bash
npx prisma generate
```

### 3.3 Seed Database (Optional)

```bash
npm run db:seed
```

## Step 4: Set Up Cron Jobs (Automatic)

### Option A: Automatic Setup (Recommended)

**EasyPanel Post-Deploy Command:**

1. Go to EasyPanel → Your App → **Settings**
2. Find **"Post Deploy Command"** or **"Startup Script"**
3. Add: `bash scripts/post-deploy.sh`
4. Save and redeploy

Cron jobs will be automatically set up on every deployment! 🎉

**Or run manually once:**
```bash
npm run setup:cron
```

### Option B: Manual Setup

If you prefer manual setup, see `CRON_SETUP.md` for detailed instructions.

**Quick manual setup:**
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to app
cd /path/to/your/app

# Run setup script
npm run setup:cron
```

**See `AUTO_CRON_SETUP.md` for complete automatic setup guide.**

## Step 5: Configure Reverse Proxy (Nginx)

If using Nginx (usually auto-configured by EasyPanel), ensure these settings:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 6: SSL Certificate

EasyPanel usually handles SSL automatically via Let's Encrypt. Ensure:
1. Your domain points to your VPS IP
2. SSL is enabled in EasyPanel
3. Force HTTPS redirect is enabled

## Step 7: File Permissions

Ensure proper permissions for uploads:

```bash
cd /path/to/your/app
mkdir -p public/uploads/logo public/uploads/favicon public/uploads/statements
chmod -R 755 public/uploads
```

## Step 8: Verify Deployment

1. **Check Application Status:**
   - Visit `https://yourdomain.com`
   - Should see login page

2. **Test Database Connection:**
   - Login as admin
   - Check if data loads correctly

3. **Test File Uploads:**
   - Upload logo in Settings
   - Upload favicon
   - Verify they appear

4. **Test Notifications:**
   - Go to Settings → Diagnostics
   - Run diagnostics
   - Test email sending

5. **Test Cron Jobs:**
   - Use "Test AI Reports" button
   - Check cron logs: `tail -f /var/log/cron`

## Step 9: Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Environment variables set
- [ ] SSL certificate active
- [ ] Cron jobs configured
- [ ] File uploads working
- [ ] Email notifications working
- [ ] Logo and favicon uploaded
- [ ] Theme color configured
- [ ] AI reports tested
- [ ] All user roles can login
- [ ] Owner portal accessible

## Troubleshooting

### Application Won't Start

1. Check logs in EasyPanel
2. Verify Node.js version: `node -v` (should be 18+)
3. Check environment variables are set
4. Verify database connection

### Database Connection Issues

1. Check `DATABASE_URL` format
2. Verify PostgreSQL is running: `systemctl status postgresql`
3. Check firewall allows database port
4. Test connection: `psql $DATABASE_URL`

### Cron Jobs Not Running

1. Check cron service: `systemctl status cron`
2. View cron logs: `grep CRON /var/log/syslog`
3. Test manually: `curl -X GET https://yourdomain.com/api/ai-reports/execute -H "Authorization: Bearer YOUR_CRON_SECRET"`
4. Verify `CRON_SECRET` matches in environment variables

### Email Not Sending

1. Check SMTP settings in Settings → Email
2. Test email in Settings → Email tab
3. Check application logs for SMTP errors
4. Verify SMTP credentials are correct
5. Try different port (465 vs 587)

### File Upload Issues

1. Check directory permissions: `chmod -R 755 public/uploads`
2. Verify disk space: `df -h`
3. Check EasyPanel file manager permissions

## Quick Deployment Commands

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Navigate to app directory
cd /path/to/your/app

# Pull latest code (if using Git)
git pull origin main

# Install dependencies
npm install --production

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Restart application (EasyPanel usually does this automatically)
# Or manually: pm2 restart app-name
```

## Production Best Practices

1. **Always use HTTPS** - SSL certificate is essential
2. **Keep dependencies updated** - Regularly run `npm audit` and `npm update`
3. **Monitor logs** - Check EasyPanel logs regularly
4. **Backup database** - Set up automated backups
5. **Monitor disk space** - File uploads can fill up storage
6. **Set up monitoring** - Use EasyPanel monitoring or external service
7. **Keep secrets secure** - Never commit `.env` files to Git

## Support Resources

- **EasyPanel Docs:** https://easypanel.io/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Prisma Deployment:** https://www.prisma.io/docs/guides/deployment
- **Hostinger Support:** https://www.hostinger.com/contact

---

**Need Help?** Check the troubleshooting section or review the logs in EasyPanel.

