# Post-Deployment Steps

## 1. Run Database Migrations

After deploying, you need to run database migrations to create all the tables:

```bash
# In your production environment (EasyPanel/Hostinger VPS)
npx prisma migrate deploy
```

Or if you're using Docker/EasyPanel, you can run it via the container:
```bash
docker exec -it <container-name> npx prisma migrate deploy
```

## 2. Generate Prisma Client

Make sure Prisma client is generated:
```bash
npx prisma generate
```

## 3. Seed the Database (Optional but Recommended)

This will create default admin users and sample data:

```bash
npm run db:seed
# or
npx prisma db seed
```

## 4. Default Login Credentials

After running the seed script, you can log in with:

### Super Admin
- **Email:** `admin@hosthub.com`
- **Password:** `admin123`

### Admin/Manager
- **Email:** `manager@hosthub.com`
- **Password:** `admin123`

⚠️ **IMPORTANT:** Change these passwords immediately after first login!

## 5. Verify Deployment

1. Visit your deployed URL
2. You should be redirected to `/auth/login`
3. Log in with the credentials above
4. Change the default passwords in Settings → Profile

## 6. Configure Settings

After logging in, configure:
- Company logo (Settings → General)
- Theme color (Settings → General)
- SMTP settings (Settings → Notifications)
- Exchange rates (Settings → General)
- Favicon (Settings → General)

## Troubleshooting

If migrations fail:
- Check that `DATABASE_URL` is correctly set in your environment variables
- Ensure the database is accessible from your application
- Check database connection logs

If seed fails:
- Make sure migrations have run successfully first
- Check that the database is empty or the seed script will handle existing data (it uses `upsert`)

