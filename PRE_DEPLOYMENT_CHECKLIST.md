# Pre-Deployment Checklist

Use this checklist before deploying to production.

## Code Preparation

- [ ] All code committed to Git
- [ ] `.env` file is NOT committed (check `.gitignore`)
- [ ] `.next` folder is in `.gitignore`
- [ ] `node_modules` is in `.gitignore`
- [ ] All build errors resolved
- [ ] All TypeScript errors fixed
- [ ] Tested locally with `npm run build`

## Environment Variables

- [ ] `DATABASE_URL` - Production PostgreSQL connection string
- [ ] `NEXTAUTH_URL` - Your production domain (https://yourdomain.com)
- [ ] `NEXTAUTH_SECRET` - Generated secure secret (use: `openssl rand -base64 32`)
- [ ] `NEXT_PUBLIC_APP_URL` - Your production domain
- [ ] `CRON_SECRET` - Generated secret for cron jobs (use: `openssl rand -hex 32`)
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- [ ] AI Provider keys (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`)
- [ ] Optional: SMS/WhatsApp credentials

## Database

- [ ] Production PostgreSQL database created
- [ ] Database connection tested
- [ ] All migrations ready to run
- [ ] Backup strategy in place

## Server Configuration

- [ ] EasyPanel installed and configured
- [ ] Node.js 18+ installed
- [ ] Domain name configured (if using)
- [ ] SSL certificate ready (Let's Encrypt via EasyPanel)
- [ ] Firewall configured (ports 80, 443, 22 open)

## Application Settings (After Deployment)

- [ ] Logo uploaded in Settings → General
- [ ] Favicon uploaded in Settings → General
- [ ] Theme color configured
- [ ] Email settings configured and tested
- [ ] SMS/WhatsApp settings configured (if using)
- [ ] AI provider configured
- [ ] Exchange rates set (if using currency conversion)

## Cron Jobs

- [ ] Cron jobs configured (see `CRON_SETUP.md`)
- [ ] `CRON_SECRET` set in environment variables
- [ ] Cron jobs tested manually

## Testing

- [ ] Admin can login
- [ ] Owner can login
- [ ] Manager can login
- [ ] File uploads work (logo, favicon)
- [ ] Email notifications work
- [ ] SMS notifications work (if configured)
- [ ] AI reports can be sent
- [ ] PDF exports work
- [ ] All pages load correctly
- [ ] No console errors

## Security

- [ ] All passwords changed from defaults
- [ ] `NEXTAUTH_SECRET` is unique and secure
- [ ] `CRON_SECRET` is unique and secure
- [ ] Database credentials are secure
- [ ] API keys are secure
- [ ] `.env` file is NOT in Git
- [ ] SSL/HTTPS is enabled

## Monitoring

- [ ] Application logs accessible
- [ ] Error tracking set up (optional)
- [ ] Uptime monitoring configured (optional)
- [ ] Database backup schedule set

## Documentation

- [ ] Team has access to deployment docs
- [ ] Credentials stored securely (password manager)
- [ ] Support contacts documented

---

**Ready to Deploy?** Follow the steps in `DEPLOYMENT.md`

