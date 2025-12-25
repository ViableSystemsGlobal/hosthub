# Database Migration Commands

## Step 1: Run Migrations (Create Tables)

First, you need to create all the database tables by running migrations:

```bash
npx prisma migrate deploy
```

This will:
- Read your `prisma/schema.prisma` file
- Create all the tables in your database
- Apply all migrations

## Step 2: Seed the Database (Create Default Users)

After migrations succeed, run the seed script:

```bash
npm run db:seed
```

This will create:
- Super Admin user (admin@hosthub.com / admin123)
- Admin user (manager@hosthub.com / admin123)
- Sample owner and property data

## Alternative: If you don't have migrations yet

If you haven't created migrations yet, you can push the schema directly:

```bash
npx prisma db push
```

Then run the seed:
```bash
npm run db:seed
```

⚠️ **Note:** `db push` is for development. For production, use `migrate deploy` with proper migrations.
