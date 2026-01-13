# Fix Render Build Error - package-lock.json Issue

## Problem
Render build is failing with:
```
npm error The `npm ci` command can only install with an existing package-lock.json
```

## Solution: Update Render Build Command

### Option 1: Use `npm install` instead of `npm ci` (Recommended)

1. **Go to Render Dashboard** → Your Web Service → **Settings**
2. **Find "Build Command"** section
3. **Update Build Command to:**
   ```
   npm install --legacy-peer-deps && npx prisma generate && npx prisma migrate deploy && npm run build
   ```

### Option 2: Ensure package-lock.json is committed (Alternative)

If you want to keep using `npm ci`, ensure package-lock.json is committed:

```bash
# Check if it's committed
git ls-files | grep package-lock.json

# If not, add and commit it
git add package-lock.json
git commit -m "Add package-lock.json for Render builds"
git push
```

## Recommended Build Command for Render

**IMPORTANT:** Render might parse `&&` incorrectly. Try these formats:

### Format 1: Single line with proper escaping
```
npm install --legacy-peer-deps && npx prisma generate && npx prisma migrate deploy && npm run build
```

### Format 2: Use semicolons instead (if && doesn't work)
```
npm install --legacy-peer-deps; npx prisma generate; npx prisma migrate deploy; npm run build
```

### Format 3: Create a build script (Most Reliable)

Create `scripts/render-build.sh`:
```bash
#!/bin/bash
set -e
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy
npm run build
```

Then in Render Build Command, use:
```
bash scripts/render-build.sh
```

**Why this works:**
- `npm install` works even if package-lock.json is missing or outdated
- `--legacy-peer-deps` handles peer dependency conflicts
- Prisma generate creates the client
- Migrations run before build
- Build completes successfully

## Alternative: Separate Migration Step

If you prefer to run migrations separately (recommended for production):

**Build Command:**
```
npm install --legacy-peer-deps && npx prisma generate && npm run build
```

**Then run migrations manually via Render Shell:**
```bash
npx prisma migrate deploy
```

This is safer because migrations won't block builds if they fail.
