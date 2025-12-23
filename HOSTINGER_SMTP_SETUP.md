# Hostinger SMTP Configuration Guide

## Common Hostinger SMTP Settings

### For Hostinger Email Accounts

If you're using a Hostinger email account (e.g., `yourname@yourdomain.com`):

**SMTP Settings:**
- **SMTP Host:** `smtp.hostinger.com`
- **SMTP Port:** `465` (SSL) or `587` (TLS/STARTTLS)
- **SMTP User:** Your full email address (e.g., `yourname@yourdomain.com`)
- **SMTP Password:** Your email account password
- **SMTP From:** Your full email address (e.g., `yourname@yourdomain.com`)

### Recommended Configuration

**For Port 465 (SSL - Recommended):**
- SMTP Host: `smtp.hostinger.com`
- SMTP Port: `465`
- Secure: Yes (SSL)

**For Port 587 (TLS/STARTTLS):**
- SMTP Host: `smtp.hostinger.com`
- SMTP Port: `587`
- Secure: No (uses STARTTLS)

## Troubleshooting Timeout Errors

### Issue: "421 4.4.2 smtp.hostinger.com Error: timeout exceeded"

This error occurs when the SMTP server takes too long to respond. Here are solutions:

#### 1. **Check Your SMTP Port**
- Try port `465` (SSL) instead of `587` (TLS)
- Or vice versa - some networks block certain ports

#### 2. **Verify SMTP Credentials**
- Ensure your email address and password are correct
- Make sure you're using the full email address as the username
- Check if your email account is active in Hostinger

#### 3. **Check Firewall/Network**
- Ensure your server can reach `smtp.hostinger.com` on ports 465 or 587
- Check if your hosting provider blocks outbound SMTP connections
- Some VPS providers require you to request SMTP access

#### 4. **Use Alternative SMTP Service**
If Hostinger SMTP continues to timeout, consider using:
- **SendGrid** (Free tier: 100 emails/day)
- **Mailgun** (Free tier: 5,000 emails/month)
- **Amazon SES** (Very affordable, pay per email)
- **Resend** (Free tier: 3,000 emails/month)

### Alternative: Using Gmail SMTP (For Testing)

If you need a quick alternative for testing:

**Gmail SMTP Settings:**
- SMTP Host: `smtp.gmail.com`
- SMTP Port: `587`
- SMTP User: Your Gmail address
- SMTP Password: Gmail App Password (not your regular password)
  - Generate at: https://myaccount.google.com/apppasswords

**Note:** Gmail has sending limits (500 emails/day for free accounts)

## Testing Your SMTP Connection

1. Go to **Settings → Email** tab
2. Click **"Test Email"** button
3. Enter your email address
4. Click **"Send Test Email"**

If the test fails with a timeout error:
- Try switching between port 465 and 587
- Check your server's network connectivity
- Verify your email credentials in Hostinger control panel
- Consider using an alternative SMTP service

## System Improvements

The system now includes:
- ✅ **Automatic retry logic** (3 attempts with exponential backoff)
- ✅ **Increased timeouts** (30 seconds instead of default)
- ✅ **Connection pooling** for better reliability
- ✅ **Better error messages** to help diagnose issues

If emails still fail after retries, the system will log the error and you can try again later or switch to an alternative SMTP service.

