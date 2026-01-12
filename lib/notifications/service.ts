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
 * Sends emails to:
 * 1. Guest (if guestEmail exists) - confirmation email
 * 2. Owner - internal notification
 * 3. Super Admin(s) - internal notification
 * 4. Manager (if property has one) - internal notification
 */
export async function sendBookingNotification(
  bookingId: string,
  event: 'created' | 'updated' | 'reminder',
  ownerId: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      Property: {
        include: {
          User: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      Owner: true,
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

  // Get all super admins (include phoneNumber for SMS)
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
    },
  })

  // Get manager if property has one (include phoneNumber for SMS)
  let managerEmail: string | null = null
  let managerName: string | null = null
  let managerPhone: string | null = null
  if (booking.Property.managerId) {
    const manager = await prisma.user.findUnique({
      where: { id: booking.Property.managerId },
      select: {
        email: true,
        name: true,
        phoneNumber: true,
      },
    })
    if (manager) {
      managerEmail = manager.email
      managerName = manager.name || null
      managerPhone = manager.phoneNumber || null
    }
  }

  // Get owner phone for SMS
  const ownerPhone = booking.Owner.phoneNumber || null

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

  // Prepare template variables for guest email
  const guestTemplateVariables = {
    guestName: booking.guestName || 'Guest',
    propertyName: propertyName,
    checkInDate: new Date(booking.checkInDate).toLocaleDateString(),
    checkOutDate: new Date(booking.checkOutDate).toLocaleDateString(),
    nights: booking.nights.toString(),
    totalAmount: (booking.baseAmount + booking.cleaningFee).toFixed(2),
    currency: booking.currency,
    bookingId: booking.id,
  }

  // Prepare template variables for internal notifications
  const internalTemplateVariables = {
    ownerName: booking.Owner.name || 'Property Owner',
    guestName: booking.guestName || 'Guest',
    guestEmail: booking.guestEmail || 'N/A',
    guestPhoneNumber: booking.guestPhoneNumber || 'N/A',
    propertyName: propertyName,
    checkInDate: new Date(booking.checkInDate).toLocaleDateString(),
    checkOutDate: new Date(booking.checkOutDate).toLocaleDateString(),
    nights: booking.nights.toString(),
    totalPayout: booking.totalPayout.toFixed(2),
    currency: booking.currency,
    bookingId: booking.id,
  }

  // Send email to guest (if guestEmail exists) - only for created events
  if (event === 'created' && booking.guestEmail) {
    try {
      console.log(`[Booking Notification] Attempting to send guest email to: ${booking.guestEmail}`)
      const { renderEmailTemplateByType } = await import('./template-renderer')
      const { generatePaystackStyleEmailHTML } = await import('./email-template')
      const { sendEmail } = await import('./email')

      const guestTemplate = await renderEmailTemplateByType('guest_booking_confirmation', guestTemplateVariables)
      if (guestTemplate) {
        console.log(`[Booking Notification] Using guest template: ${guestTemplate.subject}`)
        const emailHtml = await generatePaystackStyleEmailHTML({
          title: guestTemplate.subject,
          content: guestTemplate.body,
        })

        const result = await sendEmail({
          to: booking.guestEmail,
          subject: guestTemplate.subject,
          html: emailHtml,
        })
        
        if (result.success) {
          console.log(`[Booking Notification] ✅ Guest email sent successfully to ${booking.guestEmail}`)
        } else {
          console.error(`[Booking Notification] ❌ Failed to send guest email: ${result.error}`)
        }
      } else {
        console.log(`[Booking Notification] Guest template not found, using fallback`)
        // Fallback if template doesn't exist
        const emailHtml = await generatePaystackStyleEmailHTML({
          title: `Booking Confirmation - ${propertyName}`,
          content: `Dear ${booking.guestName || 'Guest'},<br><br>Your booking has been confirmed!<br><br>Property: ${propertyName}<br>Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}<br>Check-out: ${new Date(booking.checkOutDate).toLocaleDateString()}<br>Nights: ${booking.nights}<br>Total Amount: ${booking.currency} ${(booking.baseAmount + booking.cleaningFee).toFixed(2)}<br><br>Thank you for your booking!`,
        })

        const result = await sendEmail({
          to: booking.guestEmail,
          subject: `Booking Confirmation - ${propertyName}`,
          html: emailHtml,
        })
        
        if (result.success) {
          console.log(`[Booking Notification] ✅ Guest email sent successfully (fallback) to ${booking.guestEmail}`)
        } else {
          console.error(`[Booking Notification] ❌ Failed to send guest email (fallback): ${result.error}`)
        }
      }
    } catch (error) {
      console.error('[Booking Notification] ❌ Error sending guest booking confirmation email:', error)
    }
  } else if (event === 'created' && !booking.guestEmail) {
    console.log('[Booking Notification] ⚠️ No guest email provided, skipping guest email notification')
  }

  // Send SMS to guest (if guestPhoneNumber exists) - only for created events
  if (event === 'created' && booking.guestPhoneNumber) {
    try {
      console.log(`[Booking Notification] Attempting to send guest SMS to: ${booking.guestPhoneNumber}`)
      
      const guestSmsMessage = `Hi ${booking.guestName || 'Guest'}! Your booking at ${propertyName} is confirmed. Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}, Check-out: ${new Date(booking.checkOutDate).toLocaleDateString()}. Total: ${booking.currency} ${(booking.baseAmount + booking.cleaningFee).toFixed(2)}. Thank you!`
      
      const result = await sendSMS(booking.guestPhoneNumber, guestSmsMessage)
      
      if (result.success) {
        console.log(`[Booking Notification] ✅ Guest SMS sent successfully to ${booking.guestPhoneNumber}`)
      } else {
        console.error(`[Booking Notification] ❌ Failed to send guest SMS: ${result.error}`)
      }
    } catch (error) {
      console.error('[Booking Notification] ❌ Error sending guest SMS:', error)
    }
  } else if (event === 'created' && !booking.guestPhoneNumber) {
    console.log('[Booking Notification] ⚠️ No guest phone number provided, skipping guest SMS notification')
  }

  // Send internal notifications to owner, super admins, and manager
  const internalTitle = event === 'created' 
    ? `New Booking: ${propertyName}`
    : event === 'updated'
    ? `Booking Updated: ${propertyName}`
    : `Booking Reminder: ${propertyName}`

  const internalMessage = event === 'created'
    ? `A new booking has been created for ${propertyName}. Guest: ${booking.guestName || 'N/A'}, Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}`
    : event === 'updated'
    ? `A booking for ${propertyName} has been updated.`
    : `Reminder: You have a booking at ${propertyName} on ${new Date(booking.checkInDate).toLocaleDateString()}.`

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

  // Send notification to owner (using existing sendNotification function)
  // Include both EMAIL and SMS channels if owner has phone
  const ownerChannels = [NotificationChannel.EMAIL]
  if (ownerPhone) {
    ownerChannels.push(NotificationChannel.SMS)
  }
  
  try {
    console.log(`[Booking Notification] Attempting to send owner notification to owner: ${ownerId} (channels: ${ownerChannels.join(', ')})`)
    await sendNotification({
      ownerId,
      type: notificationType,
      channels: ownerChannels,
      title: internalTitle,
      message: internalMessage,
      actionUrl: `${baseUrl}/admin/bookings/${bookingId}`,
      actionText: 'View Booking',
      templateType: 'booking_notification_internal',
      templateVariables: internalTemplateVariables,
      metadata: {
        bookingId,
        event,
        propertyId: booking.propertyId,
      },
    })
    console.log(`[Booking Notification] ✅ Owner notification sent successfully`)
  } catch (err) {
    console.error('[Booking Notification] ❌ Failed to send owner notification:', err)
  }

  // Send email to super admins
  console.log(`[Booking Notification] Found ${superAdmins.length} super admin(s)`)
  for (const admin of superAdmins) {
    if (admin.email) {
      try {
        console.log(`[Booking Notification] Attempting to send email to super admin: ${admin.email}`)
        const { renderEmailTemplateByType } = await import('./template-renderer')
        const { generatePaystackStyleEmailHTML } = await import('./email-template')
        const { sendEmail } = await import('./email')

        const adminTemplate = await renderEmailTemplateByType('booking_notification_internal', {
          ...internalTemplateVariables,
          recipientName: admin.name || 'Admin',
        })
        
        if (adminTemplate) {
          const emailHtml = await generatePaystackStyleEmailHTML({
            title: adminTemplate.subject,
            content: adminTemplate.body,
            actionUrl: `${baseUrl}/admin/bookings/${bookingId}`,
            actionText: 'View Booking',
          })

          const result = await sendEmail({
            to: admin.email,
            subject: adminTemplate.subject,
            html: emailHtml,
          })
          
          if (result.success) {
            console.log(`[Booking Notification] ✅ Super admin email sent successfully to ${admin.email}`)
          } else {
            console.error(`[Booking Notification] ❌ Failed to send super admin email: ${result.error}`)
          }
        } else {
          console.log(`[Booking Notification] Admin template not found, using fallback`)
          // Fallback
          const emailHtml = await generatePaystackStyleEmailHTML({
            title: internalTitle,
            content: internalMessage.replace(/\n/g, '<br>'),
            actionUrl: `${baseUrl}/admin/bookings/${bookingId}`,
            actionText: 'View Booking',
          })

          const result = await sendEmail({
            to: admin.email,
            subject: internalTitle,
            html: emailHtml,
          })
          
          if (result.success) {
            console.log(`[Booking Notification] ✅ Super admin email sent successfully (fallback) to ${admin.email}`)
          } else {
            console.error(`[Booking Notification] ❌ Failed to send super admin email (fallback): ${result.error}`)
          }
        }
      } catch (error) {
        console.error(`[Booking Notification] ❌ Error sending email to super admin ${admin.email}:`, error)
      }
    } else {
      console.log(`[Booking Notification] ⚠️ Super admin ${admin.name || admin.id} has no email address`)
    }
    
    // Send SMS to super admin if they have a phone number
    if (admin.phoneNumber) {
      try {
        console.log(`[Booking Notification] Attempting to send SMS to super admin: ${admin.phoneNumber}`)
        const adminSmsMessage = `New Booking: ${propertyName}. Guest: ${booking.guestName || 'N/A'}, Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}, ${booking.nights} nights. Total: ${booking.currency} ${booking.totalPayout.toFixed(2)}`
        
        const smsResult = await sendSMS(admin.phoneNumber, adminSmsMessage)
        
        if (smsResult.success) {
          console.log(`[Booking Notification] ✅ Super admin SMS sent successfully to ${admin.phoneNumber}`)
        } else {
          console.error(`[Booking Notification] ❌ Failed to send super admin SMS: ${smsResult.error}`)
        }
      } catch (smsError) {
        console.error(`[Booking Notification] ❌ Error sending SMS to super admin ${admin.phoneNumber}:`, smsError)
      }
    }
  }

  // Send email to manager (if exists)
  if (managerEmail) {
    try {
      console.log(`[Booking Notification] Attempting to send email to manager: ${managerEmail}`)
      const { renderEmailTemplateByType } = await import('./template-renderer')
      const { generatePaystackStyleEmailHTML } = await import('./email-template')
      const { sendEmail } = await import('./email')

      const managerTemplate = await renderEmailTemplateByType('booking_notification_internal', {
        ...internalTemplateVariables,
        recipientName: managerName || 'Manager',
      })
      
      if (managerTemplate) {
        const emailHtml = await generatePaystackStyleEmailHTML({
          title: managerTemplate.subject,
          content: managerTemplate.body,
          actionUrl: `${baseUrl}/manager/bookings/${bookingId}`,
          actionText: 'View Booking',
        })

        const result = await sendEmail({
          to: managerEmail,
          subject: managerTemplate.subject,
          html: emailHtml,
        })
        
        if (result.success) {
          console.log(`[Booking Notification] ✅ Manager email sent successfully to ${managerEmail}`)
        } else {
          console.error(`[Booking Notification] ❌ Failed to send manager email: ${result.error}`)
        }
      } else {
        console.log(`[Booking Notification] Manager template not found, using fallback`)
        // Fallback
        const emailHtml = await generatePaystackStyleEmailHTML({
          title: internalTitle,
          content: internalMessage.replace(/\n/g, '<br>'),
          actionUrl: `${baseUrl}/manager/bookings/${bookingId}`,
          actionText: 'View Booking',
        })

        const result = await sendEmail({
          to: managerEmail,
          subject: internalTitle,
          html: emailHtml,
        })
        
        if (result.success) {
          console.log(`[Booking Notification] ✅ Manager email sent successfully (fallback) to ${managerEmail}`)
        } else {
          console.error(`[Booking Notification] ❌ Failed to send manager email (fallback): ${result.error}`)
        }
      }
    } catch (error) {
      console.error(`[Booking Notification] ❌ Error sending email to manager ${managerEmail}:`, error)
    }
    
    // Send SMS to manager if they have a phone number
    if (managerPhone) {
      try {
        console.log(`[Booking Notification] Attempting to send SMS to manager: ${managerPhone}`)
        const managerSmsMessage = `New Booking: ${propertyName}. Guest: ${booking.guestName || 'N/A'}, Check-in: ${new Date(booking.checkInDate).toLocaleDateString()}, ${booking.nights} nights. Total: ${booking.currency} ${booking.totalPayout.toFixed(2)}`
        
        const smsResult = await sendSMS(managerPhone, managerSmsMessage)
        
        if (smsResult.success) {
          console.log(`[Booking Notification] ✅ Manager SMS sent successfully to ${managerPhone}`)
        } else {
          console.error(`[Booking Notification] ❌ Failed to send manager SMS: ${smsResult.error}`)
        }
      } catch (smsError) {
        console.error(`[Booking Notification] ❌ Error sending SMS to manager ${managerPhone}:`, smsError)
      }
    }
  } else {
    console.log(`[Booking Notification] ⚠️ No manager assigned to property`)
  }
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
