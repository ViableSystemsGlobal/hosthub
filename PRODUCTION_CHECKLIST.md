# Production Deployment Checklist

## ✅ Issues Fixed
- [x] Dockerfile for standalone mode
- [x] Prisma generate in build phase
- [x] Start script using standalone server
- [x] Static files copying to standalone

## ⚠️ Current Issue: Server Being Killed (SIGTERM)

### Symptoms
- Server starts successfully on port 80
- Authentication works (user found, password valid)
- Server gets SIGTERM and restarts
- Login doesn't redirect to dashboard

### Possible Causes

#### 1. Database Not Initialized
**Check:** Has `npx prisma db push` been run in production?

```bash
# In production container, run:
npx prisma db push
npm run db:seed
```

#### 2. Health Check Failing
**Check:** Is `/api/health` responding?

```bash
curl http://localhost:80/api/health
```

If this returns 404 or 500, the health check is failing and EasyPanel kills the container.

#### 3. Missing Environment Variables
**Required vars:**
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

**Check in EasyPanel:**
```
Settings → Environment Variables
```

#### 4. Static Files Not Found
**Check:** After build, verify in container:

```bash
ls -la .next/standalone/.next/static/chunks/
ls -la .next/standalone/public/
```

If these are empty, static files didn't copy.

## Next Steps

### Option 1: Check Logs (Recommended)
In EasyPanel terminal:
```bash
# Check if database is initialized
npx prisma db push --skip-generate

# Check if seed is needed
npm run db:seed

# Restart the app
```

### Option 2: Verify Health Endpoint
```bash
curl http://localhost:80/api/health
```

Should return:
```json
{"status":"ok","message":"Application is healthy"}
```

### Option 3: Check Container Logs
Look for:
- Database connection errors
- Missing static files (404s)
- NextAuth errors
- Prisma errors

## If Health Check is the Issue

Update EasyPanel settings:
- **Health Check Path**: `/api/health`
- **Health Check Interval**: 30s
- **Health Check Timeout**: 3s
- **Initial Delay**: 40s (to allow startup time)

