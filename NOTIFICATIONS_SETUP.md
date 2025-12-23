# Notifications Setup Guide

This document explains how to configure SMS and Email notifications for HostHub.

## Environment Variables

Add the following environment variables to your `.env` file:

### Deywuro SMS Configuration

```env
# Deywuro SMS API Configuration
DEYWURO_USERNAME=your_deywuro_username
DEYWURO_PASSWORD=your_deywuro_password
DEYWURO_SOURCE=HostHub
```

**Getting Deywuro Credentials:**
1. Visit [Deywuro](https://www.deywuro.com)
2. Sign up for an account
3. You will receive your username and password from Npontu Technologies
4. Set your sender ID (source) - max 11 characters, alphanumeric only
5. Ensure your account has sufficient balance

**API Details:**
- Endpoint: `https://deywuro.com/api/sms`
- Methods: POST or GET
- Documentation: [Deywuro SMS API Document](https://www.deywuro.com/NewUI/Landing/images/NPONTU_SMS_API_DOCUMENT_NEW.pdf)

### Hostinger SMTP Configuration

```env
# Hostinger SMTP Configuration
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=your_email@yourdomain.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=noreply@yourdomain.com
```

**Getting Hostinger SMTP Credentials:**
1. Log in to your Hostinger account
2. Go to Email settings
3. Create an email account or use an existing one
4. Enable SMTP access
5. Use the SMTP settings provided by Hostinger

### Application URL (for notification links)

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Notification Features

### Issue Notifications

Notifications are automatically sent when:
- **Issue Created**: When a new issue is reported
- **Issue Assigned**: When an issue is assigned to a maintenance contact
- **Status Changed**: When an issue status is updated
- **Comment Added**: When a comment is added to an issue

### Booking Notifications

Notifications are automatically sent when:
- **Booking Created**: When a new booking is created
- **Booking Updated**: When booking details are updated
- **Booking Reminder**: (To be implemented) Reminders before check-in

### Notification Channels

- **Email**: Always sent for all notifications
- **SMS**: Sent for urgent/high priority issues only

## Notification History

All notifications are logged in the database and can be viewed via:
- API: `/api/notifications`
- Admin Dashboard: (To be implemented)

## Testing Notifications

To test notifications, you can:

1. Create a test issue with high priority
2. Assign it to a contact
3. Check the notification logs in the database
4. Verify emails are received
5. Verify SMS are received (for urgent issues)

## Troubleshooting

### SMS Not Sending

1. Verify `DEYWURO_API_KEY` is set correctly
2. Check phone number format (should include country code)
3. Verify sender ID is approved by Deywuro
4. Check Deywuro account balance

### Email Not Sending

1. Verify all SMTP variables are set correctly
2. Test SMTP connection using a mail client
3. Check spam folder
4. Verify `SMTP_FROM` email exists
5. Check Hostinger email account settings

### Notifications Not Appearing

1. Check notification logs in database: `Notification` table
2. Verify owner has email/phone number set
3. Check server logs for errors
4. Verify Prisma client is up to date: `npm run db:generate`

## API Documentation

### Send Notification (Internal)

```typescript
import { sendNotification } from '@/lib/notifications/service'

await sendNotification({
  ownerId: 'owner-id',
  type: NotificationType.ISSUE_CREATED,
  channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
  title: 'New Issue',
  message: 'A new issue has been created',
  htmlContent: '<p>HTML content</p>',
  actionUrl: 'https://yourdomain.com/issues/123',
  actionText: 'View Issue',
})
```

## Support

For issues with:
- **Deywuro SMS**: Contact Deywuro support
- **Hostinger SMTP**: Contact Hostinger support
- **Application Issues**: Check server logs and database

