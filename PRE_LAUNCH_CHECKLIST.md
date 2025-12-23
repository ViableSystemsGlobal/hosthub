# Pre-Launch Checklist

## 🔴 Critical (Must Do Before Launch)

### 1. Environment Variables & Configuration
- [ ] Create `.env.example` file with all required variables
- [ ] Document all environment variables in README
- [ ] Set up production environment variables:
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `NEXTAUTH_SECRET` (generate with: `openssl rand -base64 32`)
  - [ ] `NEXTAUTH_URL` (production URL)
  - [ ] `NEXT_PUBLIC_APP_URL` (production URL)
  - [ ] SMS credentials (DEYWURO_USERNAME, DEYWURO_PASSWORD, DEYWURO_SOURCE)
  - [ ] Email credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)
  - [ ] AI API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY)
- [ ] Verify `.env` is in `.gitignore` (already done ✓)
- [ ] Test all environment variables are loaded correctly

### 2. Database & Migrations
- [ ] Run `npx prisma migrate deploy` to apply all migrations to production DB
- [ ] Run `npx prisma generate` to generate Prisma client
- [ ] Verify database connection in production environment
- [ ] Set up database backups (automated daily backups recommended)
- [ ] Test database restore process
- [ ] Verify all indexes are created (check Prisma schema indexes)

### 3. Security
- [ ] Review all API routes for proper authentication/authorization
- [ ] Ensure no sensitive data in client-side code
- [ ] Verify password hashing (bcrypt) is working
- [ ] Check for SQL injection vulnerabilities (Prisma handles this, but verify)
- [ ] Review file upload security (check file types, sizes)
- [ ] Ensure HTTPS is enforced in production
- [ ] Review CORS settings if applicable
- [ ] Remove or secure any debug endpoints

### 4. Error Handling & Logging
- [ ] Replace `console.log` with proper logging service (or at least remove sensitive data)
- [ ] Set up error monitoring (e.g., Sentry, LogRocket, or similar)
- [ ] Ensure all API routes have proper error handling
- [ ] Test error scenarios (network failures, invalid data, etc.)
- [ ] Add user-friendly error messages (no stack traces in production)

### 5. Performance
- [ ] Test production build: `npm run build`
- [ ] Verify build succeeds without errors
- [ ] Test production server: `npm start`
- [ ] Check database query performance (use Prisma query logging)
- [ ] Verify database indexes are optimized
- [ ] Test with realistic data volumes
- [ ] Check image/file upload sizes and optimize if needed

### 6. Testing Critical Paths
- [ ] User login/logout
- [ ] Create/edit/delete bookings
- [ ] Create/edit/delete properties
- [ ] Create/edit/delete owners
- [ ] Issue creation and assignment
- [ ] Task creation and completion
- [ ] Expense creation
- [ ] Check-in functionality
- [ ] Cleaning checklist completion
- [ ] Electricity readings entry
- [ ] Inventory management
- [ ] Report generation and export
- [ ] SMS/Email notifications
- [ ] AI insights generation

## 🟡 Important (Should Do Before Launch)

### 7. Documentation
- [ ] Update README with:
  - [ ] Installation instructions
  - [ ] Environment variables list
  - [ ] Database setup instructions
  - [ ] Deployment instructions
  - [ ] Known issues/limitations
- [ ] Document API endpoints (or add API documentation)
- [ ] Create user guide/documentation
- [ ] Document workflow automation setup

### 8. Data Validation
- [ ] Review all form inputs for validation
- [ ] Add client-side and server-side validation
- [ ] Test edge cases (empty strings, null values, very long strings)
- [ ] Verify currency formatting
- [ ] Test date handling across timezones

### 9. User Experience
- [ ] Test responsive design on mobile devices
- [ ] Verify all links work correctly
- [ ] Test loading states (skeletons, spinners)
- [ ] Verify empty states display correctly
- [ ] Test error states and user feedback
- [ ] Check accessibility (keyboard navigation, screen readers)

### 10. Monitoring & Alerts
- [ ] Set up application monitoring (uptime, response times)
- [ ] Set up database monitoring
- [ ] Configure alerts for critical errors
- [ ] Set up log aggregation
- [ ] Monitor API response times

## 🟢 Nice to Have (Can Do Post-Launch)

### 11. Optimization
- [ ] Implement caching strategy (Redis if needed)
- [ ] Optimize images (next/image is already used)
- [ ] Add service worker for offline support
- [ ] Implement rate limiting for API routes
- [ ] Add pagination where needed

### 12. Additional Features
- [ ] Add data export functionality
- [ ] Implement audit logging
- [ ] Add user activity tracking
- [ ] Implement backup/restore UI

## 📋 Quick Pre-Launch Commands

```bash
# 1. Test production build
npm run build

# 2. Generate Prisma client
npm run db:generate

# 3. Run database migrations (on production)
npx prisma migrate deploy

# 4. Start production server locally to test
npm start

# 5. Check for TypeScript errors
npx tsc --noEmit

# 6. Check for linting errors
npm run lint
```

## 🚀 Deployment Checklist

- [ ] Choose hosting platform (Vercel, AWS, DigitalOcean, etc.)
- [ ] Set up production database (PostgreSQL)
- [ ] Configure environment variables on hosting platform
- [ ] Set up CI/CD pipeline (optional but recommended)
- [ ] Configure custom domain and SSL
- [ ] Set up database backups
- [ ] Test deployment in staging environment first
- [ ] Perform smoke tests after deployment
- [ ] Monitor application for first 24-48 hours

## ⚠️ Post-Launch Monitoring

- [ ] Monitor error rates
- [ ] Check database performance
- [ ] Monitor API response times
- [ ] Track user activity
- [ ] Review security logs
- [ ] Check notification delivery rates (SMS/Email)
- [ ] Monitor AI API usage and costs

