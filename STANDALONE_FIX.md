# Fixing Standalone Mode Issues

## Problems:
1. Static files not loading (404 errors)
2. Server Action errors
3. SIGTERM (process being killed)

## Solutions:

### 1. Rebuild the Application

The Server Action errors suggest a stale build. You need to:
- Clear the `.next` directory
- Rebuild from scratch
- Ensure all static files are generated

### 2. Check Static Files Path

In standalone mode, Next.js expects static files at:
- `.next/static/` - for static assets
- `public/` - for public assets

Make sure your Dockerfile copies these correctly (already done).

### 3. Port Configuration

If EasyPanel is using port 80, make sure:
- Your container exposes port 80
- Or set `PORT=80` environment variable
- Update the start command if needed

### 4. Health Check

I've added a health check endpoint at `/api/health` and a HEALTHCHECK in Dockerfile.

### 5. Quick Fix Commands

In your production environment:

```bash
# 1. Clear build cache
rm -rf .next

# 2. Rebuild
npm run build

# 3. Verify static files exist
ls -la .next/static
ls -la .next/standalone

# 4. Start server
node .next/standalone/server.js
```

### 6. EasyPanel Configuration

In EasyPanel:
- **Port:** Set to match your container (80 or 3000)
- **Health Check Path:** `/api/health`
- **Start Command:** `node .next/standalone/server.js`
- **Environment Variables:**
  - `PORT=80` (or whatever port EasyPanel uses)
  - `NODE_ENV=production`

### 7. If Static Files Still Don't Load

The issue might be that Next.js standalone server needs the static files in a specific location. Check:

```bash
# In your container
ls -la .next/standalone/.next/static
```

If the path is wrong, the server won't find the files. The standalone build should have:
- `server.js` in the root
- `.next/static/` directory
- `public/` directory

