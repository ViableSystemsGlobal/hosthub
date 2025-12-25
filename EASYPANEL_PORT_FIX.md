# EasyPanel Port Issue Fix

## Problem
```
Error: listen EADDRINUSE: address already in use 10.11.0.82:80
```

Port 80 is occupied by EasyPanel's internal reverse proxy.

## Solution: Use Port 3000 Instead

### Step 1: Check What's Using Port 80
In terminal:
```bash
netstat -tulpn | grep :80
# or
lsof -i :80
```

### Step 2: Change App to Use Port 3000

In **EasyPanel Dashboard**:

#### Option A: Change Environment Variable (Recommended)
1. Go to your app → **Environment**
2. Add or update:
   ```
   PORT=3000
   ```
3. Save and restart

#### Option B: Update Service Port Mapping
1. Go to **Settings** or **Network**
2. Change container port from `80` to `3000`
3. Keep external port as `80` (EasyPanel proxy handles this)

### Step 3: Test
In terminal:
```bash
# Start the app
npm start

# In another terminal, test
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"ok","message":"Application is healthy"}
```

## Why This Happens

EasyPanel uses:
- **Port 80** → Nginx/Traefik reverse proxy
- **Port 3000** → Your app (default Next.js port)

The reverse proxy forwards external requests to your app's internal port.

## Current Configuration Issue

Your `nixpacks.toml` and Dockerfile expose port 3000, but something in EasyPanel is forcing port 80.

## Quick Fix Right Now

In the container terminal:
```bash
# Start on port 3000 instead
PORT=3000 node .next/standalone/server.js
```

This should work immediately. Then update EasyPanel config to make it permanent.

