# EasyPanel Dockerfile Configuration

## How to Configure EasyPanel to Use Dockerfile

Since you have a `Dockerfile` in your repository root, you need to tell EasyPanel to use it instead of Nixpacks.

### Step-by-Step Instructions

1. **Go to EasyPanel Dashboard**
   - Navigate to your project (hosthub)

2. **Open Project Settings**
   - Click on **Settings** or **Configuration**
   - Look for **Build** or **Build Configuration** section

3. **Change Build Type**
   - Find **"Build Type"** or **"Build Method"** dropdown
   - Change from **"Nixpacks"** or **"Auto"** to **"Dockerfile"**
   - Or look for **"Use Dockerfile"** checkbox and enable it

4. **Set Dockerfile Path** (if required)
   - **Dockerfile Path**: `Dockerfile` (or leave empty/default)
   - This tells EasyPanel to use the `Dockerfile` in the repository root

5. **Save Settings**
   - Click **Save** or **Update**

6. **Trigger New Deployment**
   - Click **Deploy** or **Redeploy**
   - EasyPanel should now:
     1. Pull from Git (this should work now)
     2. Use your `Dockerfile` instead of Nixpacks
     3. Build using the Dockerfile configuration

## Why This Helps

- **Dockerfile** uses `node:22.12.0-alpine` from Docker Hub (more reliable)
- **Nixpacks** might be trying to pull from `ghcr.io` which was failing
- Using Dockerfile bypasses Nixpacks entirely and uses your custom build

## Alternative: If EasyPanel Doesn't Have "Build Type" Setting

Some EasyPanel versions might auto-detect Dockerfile. If you don't see a "Build Type" option:

1. **Make sure `Dockerfile` is in the repository root** ✅ (it is)
2. **Remove or rename `nixpacks.toml`** temporarily to force Dockerfile usage:
   ```bash
   git mv nixpacks.toml nixpacks.toml.backup
   git commit -m "Temporarily disable nixpacks to use Dockerfile"
   git push origin main
   ```

3. **Or ensure Dockerfile takes precedence** - EasyPanel should detect Dockerfile automatically if it exists

## What Your Dockerfile Does

Your `Dockerfile`:
- Uses Node.js 22.12.0 (meets Prisma requirements)
- Installs dependencies with `--legacy-peer-deps`
- Generates Prisma Client
- Builds Next.js with standalone output
- Creates optimized production image

## Verification

After configuring:

1. **Check build logs** - Should show Docker build steps instead of Nixpacks
2. **Look for**: `FROM node:22.12.0-alpine` in the logs
3. **Should see**: Docker build stages (deps, builder, runner)

## Current Setup

- ✅ `Dockerfile` exists in root
- ✅ Uses `node:22.12.0-alpine` from Docker Hub
- ✅ Configured for Next.js standalone build
- ✅ Includes Prisma generation

## Next Steps

1. **Configure EasyPanel** to use Dockerfile (see steps above)
2. **Save and deploy**
3. **Monitor build logs** to confirm it's using Dockerfile
4. **If Git pull still fails**, check EasyPanel terminal for exact error

