# Port Configuration Fix

## Issue
Your container is running on port 3000, but EasyPanel might be expecting port 80, or there's a port mismatch causing static files to not load.

## Solutions

### Option 1: Use Environment Variable (Recommended)

In EasyPanel, set:
```bash
PORT=80
```

Then the server will use port 80.

### Option 2: Update Dockerfile

Change the EXPOSE and PORT in Dockerfile:
```dockerfile
EXPOSE 80
ENV PORT 80
```

### Option 3: Use Next.js Regular Mode (Temporary Fix)

If standalone mode continues to have issues, you can temporarily disable it:

1. In `next.config.js`, comment out or remove:
```js
// output: 'standalone',
```

2. Change start command back to:
```bash
npm start
# or
next start
```

3. Rebuild and redeploy

**Note:** This will use more disk space but might be more stable initially.

### Option 4: Check EasyPanel Port Mapping

In EasyPanel:
- Check what port your service is configured to use
- Make sure the container port matches
- Check if there's a reverse proxy (nginx) that might be interfering

## Current Configuration

- Dockerfile exposes: `3000`
- Default PORT env: `3000`
- EasyPanel might be using: `80`

## Quick Test

After setting `PORT=80` in environment variables, restart the container and check:
```bash
curl http://localhost:80/api/health
```

If this works, the port is correct.

