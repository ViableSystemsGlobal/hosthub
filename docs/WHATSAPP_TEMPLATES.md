# WhatsApp Template Setup Guide

## Overview

WhatsApp requires pre-approved message templates for messages sent outside the 24-hour conversation window. This guide explains how to set up and configure WhatsApp templates in HostHub.

## How It Works

1. **Session Messages (Within 24 hours)**: If a user has messaged you within the last 24 hours, you can send freeform messages using the `Body` parameter.

2. **Template Messages (Outside 24 hours)**: For initial messages or messages sent after 24 hours, you must use pre-approved WhatsApp message templates via Twilio's Content API.

## Setting Up Templates

### Step 1: Create Templates in Twilio

1. Go to [Twilio Console](https://console.twilio.com/) → **Content** → **Templates**
2. Click **Create Template**
3. Fill in the template details:
   - **Name**: A descriptive name (e.g., "Booking Confirmation")
   - **Category**: Choose "MARKETING" or "UTILITY" (UTILITY is recommended for transactional messages)
   - **Language**: Select your language (e.g., English)
   - **Content**: Write your message with variables using `{{1}}`, `{{2}}`, etc.
   
   Example template:
   ```
   New booking at {{1}} for {{2}} on {{3}}. View details: {{4}}
   ```

4. Submit the template for approval (can take 24-48 hours)
5. Once approved, copy the **Content SID** (starts with `HX...`)

### Step 2: Configure Templates in HostHub

1. Open `lib/notifications/whatsapp-templates.ts`
2. Find the notification type you want to configure (e.g., `BOOKING_CREATED`)
3. Add your Content SID:
   ```typescript
   BOOKING_CREATED: {
     contentSid: 'HX1234567890abcdef', // Your Content SID here
     variables: ['propertyName', 'checkInDate', 'guestName', 'link']
   }
   ```
4. Ensure the `variables` array matches the order of variables in your Twilio template

### Step 3: Variable Mapping

The system automatically maps your variables to Twilio's numbered format:
- `variables[0]` → `{{1}}` in template
- `variables[1]` → `{{2}}` in template
- `variables[2]` → `{{3}}` in template
- etc.

Make sure the order in the `variables` array matches the order in your Twilio template.

## Available Notification Types

The following notification types can be configured with templates:

- `STATEMENT_READY` - When a statement is ready for an owner
- `BOOKING_CREATED` - When a new booking is created
- `BOOKING_UPDATED` - When a booking is updated
- `BOOKING_REMINDER` - Booking reminder notifications
- `ISSUE_CREATED` - When a new issue is reported
- `ISSUE_ASSIGNED` - When an issue is assigned
- `ISSUE_STATUS_CHANGED` - When an issue status changes
- `PAYOUT_MADE` - When a payout is made to an owner

## How Templates Are Used

The system automatically:
1. Checks if a template is configured for the notification type
2. If a template exists, uses the Content API with the template
3. If no template exists, attempts to send as a session message (Body)
4. If the session message fails with error 63016, you'll need to configure a template

## Testing

1. **Within 24-hour window**: Send a test message from your WhatsApp to the Twilio number first, then test sending from HostHub. This creates a session window.

2. **Outside 24-hour window**: Use the template system. Make sure your template is approved and the Content SID is configured.

## Troubleshooting

### Error 63016: "Message sent outside 24-hour window"
- **Solution**: Configure a template for this notification type in `whatsapp-templates.ts`

### Error 21614: "Template not found"
- **Solution**: Verify the Content SID is correct and the template is approved in Twilio

### Error 21610: "Message template not approved"
- **Solution**: Wait for template approval in Twilio (24-48 hours) or check template status

## Notes

- Templates must be approved by WhatsApp before use
- Template approval can take 24-48 hours
- For testing, you can use Twilio's sandbox number: `whatsapp:+14155238886`
- Session messages (within 24h) don't require templates
- Template messages work anytime, even outside the 24-hour window

