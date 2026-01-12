# Running Database Migrations on Render

## Method 1: Using Render Shell (Recommended)

1. **Go to your Render Dashboard**
   - Navigate to your Web Service
   - Click on the service name

2. **Open the Shell**
   - Click on the **"Shell"** tab in the left sidebar
   - Or use the terminal icon at the top

3. **Run the Migration Command**
   ```bash
   npx prisma migrate deploy
   ```

4. **Generate Prisma Client** (if needed)
   ```bash
   npx prisma generate
   ```

5. **Seed the Database** (optional, for initial setup)
   ```bash
   npm run db:seed
   ```

## Method 2: Add to Build Command (Automatic)

You can add migration to your build command so it runs automatically on each deployment:

1. **Go to Render Dashboard** → Your Web Service → **Settings**

2. **Update Build Command:**
   ```
   npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
   ```

   **Note:** This will run migrations on every build. Only use this if you want automatic migrations.

## Method 3: Using Render Scripts (Post-Deploy)

Create a script that runs after deployment:

1. **Create a post-deploy script** (already exists: `scripts/post-deploy.sh`)

2. **In Render Dashboard** → Your Web Service → **Settings**:
   - Find **"Post Deploy Command"** or **"Start Command"**
   - Add: `bash scripts/post-deploy.sh`

## Important Notes:

### For Production (Recommended):
```bash
npx prisma migrate deploy
```
- This applies all pending migrations
- Safe for production
- Only runs migrations that haven't been applied yet

### For Development/Quick Setup:
```bash
npx prisma db push
```
- Pushes schema changes directly (no migration history)
- Faster but not recommended for production
- Use only if you don't have migrations set up

## Environment Variables Required:

Make sure these are set in Render:
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_SECRET` or `AUTH_SECRET` - Authentication secret
- `NEXTAUTH_URL` - Your production URL
- `NEXT_PUBLIC_APP_URL` - Your production URL

## Troubleshooting:

### If migrations fail:
1. Check `DATABASE_URL` is correct in Render environment variables
2. Verify database is accessible from Render
3. Check migration files exist in `prisma/migrations/` directory

### If you get "No migrations found":
- You may need to create migrations first:
  ```bash
  npx prisma migrate dev --name initial_migration
  ```
- Then commit and push the migration files
- Then run `npx prisma migrate deploy` on Render

### If schema is out of sync:
- Use `npx prisma db push` (development only)
- Or create a new migration and deploy it

## Quick Checklist:

- [ ] Set `DATABASE_URL` in Render environment variables
- [ ] Open Render Shell
- [ ] Run `npx prisma migrate deploy`
- [ ] Run `npx prisma generate` (if needed)
- [ ] Run `npm run db:seed` (for initial setup)
- [ ] Verify application starts successfully
