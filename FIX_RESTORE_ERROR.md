# Fix Restore Error - GENERAL_MANAGER Enum Issue

## Problem
When trying to restore a backup, you get:
```
invalid input value for enum "UserRole": "GENERAL_MANAGER"
```

**Root Cause:** The production database doesn't have the `GENERAL_MANAGER` value in the `UserRole` enum. The migrations haven't been run yet.

## Solution: Run Migrations on Render

### Step 1: Open Render Shell

1. Go to **Render Dashboard** → Your Web Service
2. Click on **"Shell"** tab (or terminal icon)
3. Wait for the shell to connect

### Step 2: Run Migrations

Run these commands **one at a time** in the Render Shell:

```bash
# 1. Navigate to app directory
cd /app

# 2. Run migrations (this adds GENERAL_MANAGER to enum)
npx prisma migrate deploy

# 3. Generate Prisma Client (important!)
npx prisma generate
```

### Step 3: Verify GENERAL_MANAGER Exists

Check if the enum value was added:

```bash
npx prisma db execute --stdin <<< "SELECT unnest(enum_range(NULL::\"UserRole\"));"
```

You should see `GENERAL_MANAGER` in the output along with other roles.

### Step 4: Try Restore Again

After migrations complete:
1. Go back to your application
2. Try the restore operation again
3. It should work now!

## Alternative: Quick Fix with db push

If `prisma migrate deploy` doesn't work, use `db push`:

```bash
# This pushes the schema directly (including enum updates)
npx prisma db push

# Regenerate client
npx prisma generate
```

**Note:** `db push` doesn't create migration history, but it will fix the enum issue immediately.

## Why This Happened

The migrations that add `GENERAL_MANAGER` to the enum haven't been run on your production database yet. The restore function tries to insert user data with `role: "GENERAL_MANAGER"`, but PostgreSQL rejects it because that enum value doesn't exist in the database.

## Prevention

Make sure to run migrations **before** trying to restore backups that contain the new enum value. The build script (`scripts/render-build.sh`) now includes migrations, so future deployments should handle this automatically.
