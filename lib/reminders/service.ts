/**
 * Automated Reminders Service
 * Handles sending automated reminders for bookings, tasks, issues, etc.
 */

import { prisma } from '../prisma'
import { sendBookingNotification, sendNotification } from '../notifications/service'
import { addHours, addDays } from 'date-fns'
import { NotificationChannel, NotificationType } from '@prisma/client'

interface ReminderSettings {
  bookingReminderHours: number // Hours before check-in to send reminder (default: 24)
  taskReminderEnabled: boolean
  issueReminderEnabled: boolean
  paymentReminderEnabled: boolean
}

async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'BOOKING_REMINDER_HOURS',
            'TASK_REMINDER_ENABLED',
            'ISSUE_REMINDER_ENABLED',
            'PAYMENT_REMINDER_ENABLED',
          ],
        },
      },
    })

    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
    })

    return {
      bookingReminderHours: parseInt(settingsMap.BOOKING_REMINDER_HOURS || '24'),
      taskReminderEnabled: settingsMap.TASK_REMINDER_ENABLED === 'true',
      issueReminderEnabled: settingsMap.ISSUE_REMINDER_ENABLED === 'true',
      paymentReminderEnabled: settingsMap.PAYMENT_REMINDER_ENABLED === 'true',
    }
  } catch (error) {
    // Return defaults if settings not available
    return {
      bookingReminderHours: 24,
      taskReminderEnabled: true,
      issueReminderEnabled: true,
      paymentReminderEnabled: true,
    }
  }
}

/**
 * Send reminders for upcoming bookings
 */
export async function sendBookingReminders(): Promise<{ sent: number; errors: number }> {
  const settings = await getReminderSettings()
  const now = new Date()
  const reminderWindowStart = addHours(now, settings.bookingReminderHours - 1)
  const reminderWindowEnd = addHours(now, settings.bookingReminderHours + 1)

  let sent = 0
  let errors = 0

  try {
    // Find bookings that need reminders
    // Check-in is within the reminder window and status is UPCOMING
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'UPCOMING',
        checkInDate: {
          gte: reminderWindowStart,
          lte: reminderWindowEnd,
        },
      },
      include: {
        Owner: true,
        Property: true,
      },
    })

    for (const booking of bookings) {
      try {
        // Check if we've already sent a reminder for this booking
        // Query all BOOKING_REMINDER notifications for this owner and check payload
        const existingReminders = await prisma.notification.findMany({
          where: {
            ownerId: booking.ownerId,
            type: NotificationType.BOOKING_REMINDER,
          },
        })
        const existingReminder = existingReminders.find(
          (n) => (n.payload as any)?.metadata?.bookingId === booking.id
        )

        // Only send if we haven't sent a reminder yet
        if (!existingReminder) {
          await sendBookingNotification(booking.id, 'reminder', booking.ownerId)
          sent++
        }
      } catch (error) {
        console.error(`Failed to send reminder for booking ${booking.id}:`, error)
        errors++
      }
    }
  } catch (error) {
    console.error('Error in sendBookingReminders:', error)
    errors++
  }

  return { sent, errors }
}

/**
 * Send reminders for overdue tasks
 */
export async function sendTaskReminders(): Promise<{ sent: number; errors: number }> {
  const settings = await getReminderSettings()
  if (!settings.taskReminderEnabled) {
    return { sent: 0, errors: 0 }
  }

  const now = new Date()
  let sent = 0
  let errors = 0

  try {
    // Find overdue tasks (dueAt is in the past and status is PENDING)
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: 'PENDING',
        dueAt: {
          lt: now, // Due date is in the past
        },
      },
      include: {
        Property: {
          include: {
            Owner: true,
          },
        },
        Booking: true,
      },
    })

    for (const task of overdueTasks) {
      try {
        // Check if we've sent a reminder for this task today
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const existingReminders = await prisma.notification.findMany({
          where: {
            ownerId: task.Property.ownerId,
            type: 'TASK_UPDATE',
            createdAt: {
              gte: today,
            },
          },
        })
        const existingReminder = existingReminders.find(
          (n) => (n.payload as any)?.metadata?.taskId === task.id
        )

        // Only send one reminder per day per task
        if (!existingReminder) {
          await sendNotification({
            ownerId: task.Property.ownerId,
            type: NotificationType.TASK_UPDATE,
            channels: [NotificationChannel.EMAIL],
            title: `Overdue Task: ${task.title}`,
            message: `Task "${task.title}" for ${task.Property.name} is overdue. Due date: ${task.dueAt ? new Date(task.dueAt).toLocaleDateString() : 'N/A'}`,
            metadata: {
              taskId: task.id,
              propertyId: task.propertyId,
            },
          })
          sent++
        }
      } catch (error) {
        console.error(`Failed to send reminder for task ${task.id}:`, error)
        errors++
      }
    }
  } catch (error) {
    console.error('Error in sendTaskReminders:', error)
    errors++
  }

  return { sent, errors }
}

/**
 * Send reminders for pending issues
 */
export async function sendIssueReminders(): Promise<{ sent: number; errors: number }> {
  const settings = await getReminderSettings()
  if (!settings.issueReminderEnabled) {
    return { sent: 0, errors: 0 }
  }

  const now = new Date()
  const twoDaysAgo = addDays(now, -2)
  let sent = 0
  let errors = 0

  try {
    // Find pending issues older than 2 days
    const pendingIssues = await prisma.issue.findMany({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
        createdAt: {
          lt: twoDaysAgo, // Created more than 2 days ago
        },
      },
      include: {
        Property: {
          include: {
            Owner: true,
          },
        },
      },
    })

    for (const issue of pendingIssues) {
      try {
        // Check if we've sent a reminder for this issue today
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const existingReminders = await prisma.notification.findMany({
          where: {
            ownerId: issue.Property.ownerId,
            type: 'ISSUE_STATUS_CHANGED',
            createdAt: {
              gte: today,
            },
          },
        })
        const existingReminder = existingReminders.find(
          (n) => (n.payload as any)?.metadata?.issueId === issue.id
        )

        // Only send one reminder per day per issue
        if (!existingReminder) {
          await sendNotification({
            ownerId: issue.Property.ownerId,
            type: NotificationType.ISSUE_STATUS_CHANGED,
            channels: [NotificationChannel.EMAIL],
            title: `Pending Issue Reminder: ${issue.title}`,
            message: `Issue "${issue.title}" for ${issue.Property.name} has been pending for more than 2 days. Current status: ${issue.status}`,
            metadata: {
              issueId: issue.id,
              propertyId: issue.propertyId,
            },
          })
          sent++
        }
      } catch (error) {
        console.error(`Failed to send reminder for issue ${issue.id}:`, error)
        errors++
      }
    }
  } catch (error) {
    console.error('Error in sendIssueReminders:', error)
    errors++
  }

  return { sent, errors }
}

/**
 * Run all reminder checks
 */
export async function runAllReminders(): Promise<{
  bookings: { sent: number; errors: number }
  tasks: { sent: number; errors: number }
  issues: { sent: number; errors: number }
}> {
  const [bookings, tasks, issues] = await Promise.all([
    sendBookingReminders(),
    sendTaskReminders(),
    sendIssueReminders(),
  ])

  return {
    bookings,
    tasks,
    issues,
  }
}

