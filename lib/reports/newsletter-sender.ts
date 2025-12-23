/**
 * Newsletter Report Sender
 * Sends AI-generated newsletter reports via email
 */

import { generateNewsletterReport, NewsletterReport } from './ai-newsletter'
import { generateNewsletterEmailHTML } from './email-template'
import { sendEmail } from '@/lib/notifications/email'
import { prisma } from '@/lib/prisma'
import { ReportSchedule } from '@prisma/client'

/**
 * Send newsletter report to recipients
 */
export async function sendNewsletterReport(
  reportId: string,
  recipients: string[]
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  // Get report configuration
  // @ts-ignore - Report model may not be in types yet
  const reportModel = (prisma as any).report
  if (!reportModel) {
    throw new Error('Report model not available. Please restart the server after running prisma generate.')
  }
  const report = await reportModel.findUnique({
    where: { id: reportId },
  })

  if (!report) {
    throw new Error('Report not found')
  }

  if (!report.isActive) {
    throw new Error('Report is not active')
  }

  // Determine period from schedule
  let period: 'daily' | 'weekly' | 'monthly' = 'daily'
  switch (report.schedule) {
    case ReportSchedule.DAILY:
      period = 'daily'
      break
    case ReportSchedule.WEEKLY:
      period = 'weekly'
      break
    case ReportSchedule.MONTHLY:
      period = 'monthly'
      break
    default:
      period = 'daily'
  }

  // Generate newsletter report
  const newsletter = await generateNewsletterReport(period, report.filters as any)

  // Generate HTML email
  const emailHTML = generateNewsletterEmailHTML(newsletter)

  // Send to all recipients
  const results = await Promise.allSettled(
    recipients.map((email) =>
      sendEmail({
        to: email,
        subject: newsletter.subject,
        html: emailHTML,
      })
    )
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - sent
  const errors = results
    .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
    .map((r) => {
      if (r.status === 'rejected') return r.reason?.message || 'Unknown error'
      return r.value.error || 'Unknown error'
    })

  // Update report with last generated timestamp
  // @ts-ignore
  const reportModel = (prisma as any).report
  if (!reportModel) {
    throw new Error('Report model not available. Please restart the server.')
  }
  await reportModel.update({
    where: { id: reportId },
    data: {
      lastGeneratedAt: new Date(),
    },
  })

  return { success: sent > 0, sent, failed, errors }
}

/**
 * Execute all scheduled reports that are due
 */
export async function executeScheduledReports(): Promise<{
  executed: number
  success: number
  failed: number
}> {
  const now = new Date()

  // Find all active scheduled reports that are due
  // @ts-ignore
  const reportModel = (prisma as any).report
  if (!reportModel) {
    throw new Error('Report model not available. Please restart the server.')
  }
  const reports = await reportModel.findMany({
    where: {
      isActive: true,
      schedule: {
        not: ReportSchedule.NONE,
      },
      OR: [
        { nextRunAt: { lte: now } },
        { nextRunAt: null },
      ],
    },
  })

  let executed = 0
  let success = 0
  let failed = 0

  for (const report of reports) {
    try {
      executed++

      if (!report.emailRecipients || report.emailRecipients.length === 0) {
        console.warn(`Report ${report.id} has no email recipients, skipping`)
        failed++
        continue
      }

      const result = await sendNewsletterReport(report.id, report.emailRecipients)

      if (result.success) {
        success++
      } else {
        failed++
      }

      // Calculate next run time
      const nextRunAt = calculateNextRunTime(report.schedule, report.scheduleDay, report.scheduleTime)

      // @ts-ignore
      const reportModel = (prisma as any).report
      if (!reportModel) {
        console.error('Report model not available')
        continue
      }
      await reportModel.update({
        where: { id: report.id },
        data: {
          nextRunAt,
        },
      })
    } catch (error: any) {
      console.error(`Failed to execute report ${report.id}:`, error)
      failed++
    }
  }

  return { executed, success, failed }
}

/**
 * Calculate next run time based on schedule
 */
function calculateNextRunTime(
  schedule: ReportSchedule,
  scheduleDay: number | null,
  scheduleTime: string | null
): Date {
  const now = new Date()
  const nextRun = new Date()

  if (!scheduleTime) {
    scheduleTime = '08:00' // Default to 8 AM
  }

  const [hours, minutes] = scheduleTime.split(':').map(Number)
  nextRun.setHours(hours, minutes, 0, 0)

  switch (schedule) {
    case ReportSchedule.DAILY:
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
      break

    case ReportSchedule.WEEKLY:
      if (scheduleDay !== null && scheduleDay !== undefined) {
        const daysUntilNext = (scheduleDay - now.getDay() + 7) % 7
        nextRun.setDate(now.getDate() + (daysUntilNext || 7))
      } else {
        nextRun.setDate(now.getDate() + 7)
      }
      break

    case ReportSchedule.MONTHLY:
      if (scheduleDay !== null && scheduleDay !== undefined) {
        nextRun.setDate(scheduleDay)
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1)
        }
      } else {
        nextRun.setMonth(now.getMonth() + 1)
      }
      break

    case ReportSchedule.QUARTERLY:
      nextRun.setMonth(now.getMonth() + 3)
      break

    default:
      nextRun.setDate(now.getDate() + 1)
  }

  return nextRun
}

