/**
 * Notification Service
 * Handles sending notifications via SMS and Email
 */

import { prisma } from '../prisma'
import { sendSMS } from './sms'
import { sendEmail, generateEmailTemplate } from './email'
import { sendWhatsApp } from './whatsapp'
import { getWhatsAppTemplate } from './whatsapp-templates'
import { renderEmailTemplateByType } from './template-renderer'
import { renderSMSTemplateByType } from './sms-template-renderer'
import { NotificationChannel, NotificationType, NotificationStatus } from '@prisma/client'

function getNotificationTypeForEvent(event: 'created' | 'assigned' | 'status_changed' | 'commented'): NotificationType {
  switch (event) {
    case 'created':
      return NotificationType.ISSUE_CREATED
    case 'assigned':
      return NotificationType.ISSUE_ASSIGNED
    case 'status_changed':
      return NotificationType.ISSUE_STATUS_CHANGED
    case 'commented':
      return NotificationType.ISSUE_COMMENTED
    default:
      return NotificationType.OTHER
  }
}

interface NotificationData {
  ownerId: string
  type: NotificationType
  channels: NotificationChannel[]
  title: string
  message: string
  htmlContent?: string
  actionUrl?: string
  actionText?: string
  metadata?: Record<string, any>
  templateType?: string // e.g., 'booking_confirmation', 'issue_notification'
  templateVariables?: Record<string, any> // Variables to use in template
}

export async function sendNotification(data: NotificationData): Promise<void> {
  const { ownerId, type, channels, title, message, htmlContent, actionUrl, actionText, metadata, templateType, templateVariables } = data

  // Get owner details
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { User: true },
  })

  if (!owner) {
    throw new Error(`Owner with id ${ownerId} not found`)
  }

  // Determine recipient email and phone
  const recipientEmail = owner.User?.email || owner.email
  const recipientPhone = owner.phoneNumber || owner.whatsappNumber
  const recipientWhatsApp = owner.whatsappNumber || owner.phoneNumber

  // Send notifications via each requested channel
  for (const channel of channels) {
    let notificationRecord = await prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        ownerId,
        type,
        channel,
        status: NotificationStatus.PENDING,
        payload: {
          title,
          message,
          htmlContent,
          actionUrl,
          actionText,
          metadata,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    try {
      if (channel === NotificationChannel.SMS && recipientPhone) {
        let smsMessage = message

        // Try to use SMS template if templateType is provided
        if (templateType && templateVariables) {
          const templateResult = await renderSMSTemplateByType(templateType, templateVariables)
          if (templateResult) {
            smsMessage = templateResult.message
          }
        }

        const result = await sendSMS(recipientPhone, smsMessage)
        
        await prisma.notification.update({
          where: { id: notificationRecord.id },
          data: {
            status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error || null,
            updatedAt: new Date(),
          },
        })
      } else if (channel === NotificationChannel.WHATSAPP && recipientWhatsApp) {
        let whatsappMessage = message

        // Try to use SMS template if templateType is provided (WhatsApp can use same templates)
        if (templateType && templateVariables) {
          const templateResult = await renderSMSTemplateByType(templateType, templateVariables)
          if (templateResult) {
            whatsappMessage = templateResult.message
          }
        }

        // Check if we have a WhatsApp template for this notification type
        // This is required for messages outside the 24-hour window
        const template = getWhatsAppTemplate(type, {
          ...(templateVariables || {}),
          ...(actionUrl ? { link: actionUrl } : {}),
        })
        
        const result = await sendWhatsApp(
          recipientWhatsApp,
          whatsappMessage,
          {
            actionUrl,
            actionText,
          },
          undefined, // config
          template || undefined // template options - will use Content API if template exists
        )
        
        await prisma.notification.update({
          where: { id: notificationRecord.id },
          data: {
            status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error || null,
            updatedAt: new Date(),
          },
        })
      } else if (channel === NotificationChannel.EMAIL && recipientEmail) {
        let emailSubject = title
        let emailHtml = htmlContent

        // Try to use template if templateType is provided
        if (templateType && templateVariables) {
          const templateResult = await renderEmailTemplateByType(templateType, templateVariables)
          if (templateResult) {
            emailSubject = templateResult.subject
            // Use Paystack-style template wrapper
            const { generatePaystackStyleEmailHTML } = await import('@/lib/notifications/email-template')
            emailHtml = await generatePaystackStyleEmailHTML({
              title: emailSubject,
              content: templateResult.body,
              actionUrl,
              actionText,
            })
          }
        }

        // Use Paystack-style template if no HTML content provided
        if (!emailHtml) {
          const { generatePaystackStyleEmailHTML } = await import('@/lib/notifications/email-template')
          emailHtml = await generatePaystackStyleEmailHTML({
            title: emailSubject,
            content: message,
            actionUrl,
            actionText,
          })
        }

        const result = await sendEmail({
          to: recipientEmail,
          subject: emailSubject,
          html: emailHtml,
        })

        await prisma.notification.update({
          where: { id: notificationRecord.id },
          data: {
            status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error || null,
            updatedAt: new Date(),
          },
        })
      } else {
        // Channel not available (no phone/email/whatsapp)
        await prisma.notification.update({
          where: { id: notificationRecord.id },
          data: {
            status: NotificationStatus.FAILED,
            errorMessage: channel === NotificationChannel.SMS 
              ? 'No phone number available for owner'
              : channel === NotificationChannel.WHATSAPP
              ? 'No WhatsApp number available for owner'
              : 'No email address available for owner',
            updatedAt: new Date(),
          },
        })
      }
    } catch (error: any) {
      await prisma.notification.update({
        where: { id: notificationRecord.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: error.message,
          updatedAt: new Date(),
        },
      })
    }
  }
}

/**
 * Send issue notification
 */
export async function sendIssueNotification(
  issueId: string,
  event: 'created' | 'assigned' | 'status_changed' | 'commented',
  recipientIds: string[]
): Promise<void> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      Property: true,
      AssignedContact: true,
    },
  })

  if (!issue) return

  const propertyName = issue.Property.nickname || issue.Property.name
  
  // Get app URL from settings or environment
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const appUrlSetting = await prisma.setting.findUnique({
      where: { key: 'NEXT_PUBLIC_APP_URL' },
    })
    if (appUrlSetting?.value) {
      baseUrl = appUrlSetting.value
    }
  } catch (error) {
    // Use default if settings not available
  }

  let title = ''
  let message = ''
  let actionUrl = ''

  switch (event) {
    case 'created':
      title = `New Issue: ${issue.title}`
      message = `A new issue "${issue.title}" has been reported for ${propertyName}. Priority: ${issue.priority}`
      actionUrl = `${baseUrl}/admin/issues/${issueId}`
      break
    case 'assigned':
      title = `Issue Assigned: ${issue.title}`
      message = `You have been assigned to issue "${issue.title}" for ${propertyName}. Priority: ${issue.priority}`
      actionUrl = `${baseUrl}/admin/issues/${issueId}`
      break
    case 'status_changed':
      title = `Issue Status Updated: ${issue.title}`
      message = `The status of issue "${issue.title}" for ${propertyName} has been updated to ${issue.status}.`
      actionUrl = `${baseUrl}/admin/issues/${issueId}`
      break
    case 'commented':
      title = `New Comment on Issue: ${issue.title}`
      message = `A new comment has been added to issue "${issue.title}" for ${propertyName}.`
      actionUrl = `${baseUrl}/admin/issues/${issueId}`
      break
  }

  // Determine channels based on owner preferences
  const channels: NotificationChannel[] = []
  // For now, send both SMS and Email. Later, we can add preferences
  channels.push(NotificationChannel.EMAIL)
  if (issue.priority === 'URGENT' || issue.priority === 'HIGH') {
    channels.push(NotificationChannel.SMS)
  }

  // Prepare template variables
  const owner = await prisma.owner.findUnique({
    where: { id: recipientIds[0] },
  })

  const templateVariables = {
    ownerName: owner?.name || '',
    propertyName: propertyName,
    issueTitle: issue.title,
    issueDescription: issue.description || '',
    issueStatus: issue.status,
    issuePriority: issue.priority,
    issueId: issue.id,
  }

  // Send to each recipient
  for (const ownerId of recipientIds) {
    await sendNotification({
      ownerId,
      type: getNotificationTypeForEvent(event),
      channels,
      title,
      message,
      actionUrl,
      actionText: 'View Issue',
      templateType: 'issue_notification',
      templateVariables,
      metadata: {
        issueId,
        event,
        propertyId: issue.propertyId,
      },
    })
  }
}

/**
 * Send booking notification
 */
export async function sendBookingNotification(
  bookingId: string,
  event: 'created' | 'updated' | 'reminder',
  ownerId: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      Property: true,
    },
  })

  if (!booking) return

  const propertyName = booking.Property.nickname || booking.Property.name
  
  // Get app URL from settings or environment
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const appUrlSetting = await prisma.setting.findUnique({
      where: { key: 'NEXT_PUBLIC_APP_URL' },
    })
    if (appUrlSetting?.value) {
      baseUrl = appUrlSetting.value
    }
  } catch (error) {
    // Use default if settings not available
  }

  let title = ''
  let message = ''

  switch (event) {
    case 'created':
      title = `New Booking: ${propertyName}`
      message = `A new booking has been created for ${propertyName}. Guest: ${booking.guestName || 'N/A'}, Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}`
      break
    case 'updated':
      title = `Booking Updated: ${propertyName}`
      message = `A booking for ${propertyName} has been updated.`
      break
    case 'reminder':
      title = `Booking Reminder: ${propertyName}`
      message = `Reminder: You have a booking at ${propertyName} on ${new Date(booking.checkInDate).toLocaleDateString()}.`
      break
  }

  // Check notification preferences from settings
  let notifyOnBookingCreated = true
  let notifyOnBookingUpdated = true
  
  try {
    const notificationSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['NOTIFY_ON_BOOKING_CREATED', 'NOTIFY_ON_BOOKING_UPDATED'],
        },
      },
    })

    notificationSettings.forEach((setting) => {
      const value = setting.value === 'true'
      if (setting.key === 'NOTIFY_ON_BOOKING_CREATED') notifyOnBookingCreated = value
      if (setting.key === 'NOTIFY_ON_BOOKING_UPDATED') notifyOnBookingUpdated = value
    })
  } catch (error) {
    // Use defaults if settings not available
  }

  // Check if this event type should send notifications
  const shouldNotify =
    (event === 'created' && notifyOnBookingCreated) ||
    (event === 'updated' && notifyOnBookingUpdated) ||
    event === 'reminder' // Always notify for reminders

  if (!shouldNotify) {
    return // Don't send notification if disabled for this event
  }

  const channels: NotificationChannel[] = [NotificationChannel.EMAIL]
  
  let notificationType: NotificationType
  switch (event) {
    case 'created':
      notificationType = NotificationType.BOOKING_CREATED
      break
    case 'updated':
      notificationType = NotificationType.BOOKING_UPDATED
      break
    case 'reminder':
      notificationType = NotificationType.BOOKING_REMINDER
      break
    default:
      notificationType = NotificationType.OTHER
  }

  // Get owner for template variables
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
  })

  // Determine template type based on event
  let templateType: string
  switch (event) {
    case 'created':
    case 'updated':
      templateType = 'booking_confirmation'
      break
    case 'reminder':
      templateType = 'booking_reminder'
      break
    default:
      templateType = 'booking_confirmation'
  }

  // Prepare template variables
  // Note: This email is sent to the OWNER, not the guest
  // So we use ownerName instead of guestName in the greeting
  const templateVariables = {
    ownerName: owner?.name || 'Property Owner',
    guestName: booking.guestName || 'Guest', // Keep for reference in the message
    propertyName: propertyName,
    checkInDate: new Date(booking.checkInDate).toLocaleDateString(),
    checkOutDate: new Date(booking.checkOutDate).toLocaleDateString(),
    nights: booking.nights.toString(),
    totalPayout: booking.totalPayout.toFixed(2),
    currency: booking.currency,
    bookingId: booking.id,
  }

  await sendNotification({
    ownerId,
    type: notificationType,
    channels,
    title,
    message,
    actionUrl: `${baseUrl}/admin/bookings/${bookingId}`,
    actionText: 'View Booking',
    templateType,
    templateVariables,
    metadata: {
      bookingId,
      event,
      propertyId: booking.propertyId,
    },
  })
}

/**
 * Send payout notification
 */
export async function sendPayoutNotification(
  payoutId: string,
  ownerId: string
): Promise<void> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
  })

  if (!payout) return

  // Get app URL from settings or environment
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const appUrlSetting = await prisma.setting.findUnique({
      where: { key: 'NEXT_PUBLIC_APP_URL' },
    })
    if (appUrlSetting?.value) {
      baseUrl = appUrlSetting.value
    }
  } catch (error) {
    // Use default if settings not available
  }

  // Get owner for template variables
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
  })

  const title = 'Payout Processed'
  const message = `A payout of ${payout.currency} ${payout.amount.toFixed(2)} has been processed${payout.method ? ` via ${payout.method}` : ''}${payout.reference ? ` (Ref: ${payout.reference})` : ''}.`

  const channels: NotificationChannel[] = [NotificationChannel.EMAIL]

  // Prepare template variables
  const templateVariables = {
    ownerName: owner?.name || '',
    amount: payout.amount.toFixed(2),
    currency: payout.currency,
    payoutDate: new Date(payout.createdAt).toLocaleDateString(),
    payoutId: payout.id,
  }

  await sendNotification({
    ownerId,
    type: NotificationType.PAYOUT_MADE,
    channels,
    title,
    message,
    actionUrl: `${baseUrl}/admin/owners/${ownerId}`,
    actionText: 'View Owner Details',
    templateType: 'payout_notification',
    templateVariables,
    metadata: {
      payoutId,
      amount: payout.amount,
      currency: payout.currency,
      method: payout.method,
    },
  })
}

/**
 * Trigger statement ready notification
 */
export async function triggerStatementReadyNotification(
  statementId: string
): Promise<void> {
  const statement = await prisma.statement.findUnique({
    where: { id: statementId },
    include: {
      Owner: true,
    },
  })

  if (!statement || !statement.Owner) return

  // Get app URL from settings or environment
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const appUrlSetting = await prisma.setting.findUnique({
      where: { key: 'NEXT_PUBLIC_APP_URL' },
    })
    if (appUrlSetting?.value) {
      baseUrl = appUrlSetting.value
    }
  } catch (error) {
    // Use default if settings not available
  }

  const owner = statement.Owner
  const periodLabel = `${statement.periodStart.toISOString().split('T')[0]} to ${statement.periodEnd.toISOString().split('T')[0]}`
  
  const title = 'Statement Ready'
  const message = `Your statement for ${periodLabel} is ready. Net earnings: ${statement.displayCurrency} ${statement.netToOwner.toFixed(2)}.`

  const channels: NotificationChannel[] = [NotificationChannel.EMAIL]
  
  // Add SMS if phone number available
  if (owner.phoneNumber) {
    channels.push(NotificationChannel.SMS)
  }
  
  // Add WhatsApp if WhatsApp number available
  if (owner.whatsappNumber) {
    channels.push(NotificationChannel.WHATSAPP)
  }

  // Prepare template variables
  const templateVariables = {
    ownerName: owner.name || '',
    periodLabel,
    netAmount: statement.netToOwner.toFixed(2),
    currency: statement.displayCurrency,
    statementId: statement.id,
    periodStart: statement.periodStart.toISOString().split('T')[0],
    periodEnd: statement.periodEnd.toISOString().split('T')[0],
  }

  await sendNotification({
    ownerId: owner.id,
    type: NotificationType.STATEMENT_READY,
    channels,
    title,
    message,
    actionUrl: `${baseUrl}/owner/statements/${statementId}`,
    actionText: 'View Statement',
    templateType: 'statement_ready',
    templateVariables,
    metadata: {
      statementId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      netToOwner: statement.netToOwner,
      currency: statement.displayCurrency,
    },
  })
}
