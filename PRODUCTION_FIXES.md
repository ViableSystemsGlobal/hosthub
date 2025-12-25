# Production Fixes - Required Steps

## Issues Found:
1. ❌ Database tables don't exist
2. ❌ Wrong start command for standalone mode
3. ❌ AUTH_SECRET not set
4. ❌ NextAuth UntrustedHost error

## Fixes Applied:
✅ Updated `package.json` start command for standalone mode
✅ Added `trustHost: true` to NextAuth configuration

## Steps to Fix in Production:

### 1. Run Database Migrations (CRITICAL - Do this first!)

```bash
# In your production container/environment
npx prisma db push
# OR if you have migrations:
npx prisma migrate deploy
```

### 2. Set Environment Variables

Add these to your EasyPanel environment variables or `.env` file:

```bash
# Required for NextAuth
AUTH_SECRET=a69cceb1e60a3a9e819f4817055879ab611ca200d9d5208ad7761902cf420c2d
# OR use NEXTAUTH_SECRET (both work)
NEXTAUTH_SECRET=a69cceb1e60a3a9e819f4817055879ab611ca200d9d5208ad7761902cf420c2d

# Your production URL
NEXTAUTH_URL=https://hosthub.byaurarealty.com
NEXT_PUBLIC_APP_URL=https://hosthub.byaurarealty.com
```

### 3. Update Start Command in EasyPanel

In EasyPanel, update the start command to:
```bash
node .next/standalone/server.js
```

Or update your `package.json` start script (already done in code).

### 4. Seed the Database

After migrations succeed:
```bash
npm run db:seed
```

This creates:
- Super Admin: `admin@hosthub.com` / `admin123`
- Admin: `manager@hosthub.com` / `admin123`

### 5. Restart Your Application

After setting environment variables, restart your application in EasyPanel.

## Quick Checklist:

- [ ] Run `npx prisma db push` (creates all tables)
- [ ] Set `AUTH_SECRET` or `NEXTAUTH_SECRET` environment variable
- [ ] Set `NEXTAUTH_URL=https://hosthub.byaurarealty.com`
- [ ] Set `NEXT_PUBLIC_APP_URL=https://hosthub.byaurarealty.com`
- [ ] Update start command to `node .next/standalone/server.js`
- [ ] Run `npm run db:seed` (creates default users)
- [ ] Restart application

## After Fixes:

1. Visit https://hosthub.byaurarealty.com
2. You should be redirected to login
3. Log in with `admin@hosthub.com` / `admin123`
4. Change password immediately!

