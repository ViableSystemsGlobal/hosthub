# Fix Production Database - Step by Step

## Problem
Your production database is missing:
1. New Booking columns (guestEmail, guestPhoneNumber, guestContactId)
2. GuestContact table
3. GENERAL_MANAGER value in UserRole enum

## Solution: Run Migrations on Render

### Step 1: Open Render Shell

1. Go to **Render Dashboard** → Your Web Service
2. Click on **"Shell"** tab (or terminal icon)
3. Wait for the shell to connect

### Step 2: Run Migrations

Run these commands **one at a time** in the Render Shell:

```bash
# 1. Navigate to app directory (if needed)
cd /app

# 2. Run migrations (this will create tables and add enum value)
npx prisma migrate deploy

# 3. Generate Prisma Client (important!)
npx prisma generate

# 4. Verify migrations worked (optional - check if tables exist)
npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('Booking', 'GuestContact');"
```

### Step 3: Verify the Fix

After running migrations, check:

1. **GuestContact table exists:**
   ```bash
   npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"GuestContact\";"
   ```

2. **Booking table has new columns:**
   ```bash
   npx prisma db execute --stdin <<< "SELECT column_name FROM information_schema.columns WHERE table_name = 'Booking' AND column_name IN ('guestEmail', 'guestPhoneNumber', 'guestContactId');"
   ```

3. **GENERAL_MANAGER enum exists:**
   ```bash
   npx prisma db execute --stdin <<< "SELECT unnest(enum_range(NULL::\"UserRole\"));"
   ```
   This should show `GENERAL_MANAGER` in the list.

### Step 4: Restart Your Service

After migrations complete:
1. Go to Render Dashboard → Your Web Service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
   OR
3. Click **"Restart"** button

## Alternative: If Migrations Fail

If `prisma migrate deploy` fails, you can use `db push` (development only, but works for fixing production):

```bash
# WARNING: This pushes schema directly without migration history
npx prisma db push

# Then regenerate client
npx prisma generate
```

## Troubleshooting

### Error: "Migration already applied"
- This is fine! It means the migration was already run
- Just run `npx prisma generate` to update the client

### Error: "Enum value already exists"
- The enum update might have been applied manually
- Continue with the rest of the migrations

### Error: "Table already exists"
- Some tables might already exist
- The migration uses `IF NOT EXISTS` so it should be safe
- Continue with the migration

### Error: "Cannot connect to database"
- Check `DATABASE_URL` in Render environment variables
- Verify database is accessible from Render

## After Fixing

Once migrations are complete:
1. ✅ All errors should be resolved
2. ✅ Guest Contacts should work
3. ✅ GENERAL_MANAGER role should work
4. ✅ Booking form should work with guest fields

## Quick Command Reference

```bash
# Full migration process
npx prisma migrate deploy
npx prisma generate

# Check what migrations are pending
npx prisma migrate status

# View database schema
npx prisma db pull
```
