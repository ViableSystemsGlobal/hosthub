/**
 * Owner AI Report Service
 * Generates and sends AI-powered reports to owners based on their preferences
 */

import { prisma } from '../prisma'
import { generateNewsletterReport, NewsletterReport } from './ai-newsletter'
import { generateNewsletterEmailHTML } from './email-template'
import { sendEmail } from '../notifications/email'
import { addDays, addWeeks, setHours, setMinutes, startOfDay } from 'date-fns'

export interface OwnerAIReportConfig {
  ownerId: string
  frequency: 'daily' | 'weekly' | 'none'
  enabled: boolean
  preferredTime?: string // HH:mm format
}

/**
 * Send AI report to a specific owner
 */
export async function sendOwnerAIReport(
  ownerId: string,
  period?: 'daily' | 'weekly' | 'monthly' | 'yesterday' | 'last-week' | 'last-month' | 'current-year'
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        User: {
          select: {
            email: true,
          },
        },
      },
    })

    if (!owner) {
      return { success: false, error: 'Owner not found' }
    }

    if (!owner.aiReportEnabled || !owner.aiReportFrequency || owner.aiReportFrequency === 'none') {
      return { success: false, error: 'AI reports not enabled for this owner' }
    }

    // Get owner's email
    const recipientEmail = owner.User?.email || owner.email
    if (!recipientEmail) {
      return { success: false, error: 'Owner has no email address' }
    }

    // Get owner's properties
    const propertyIds = owner.Property.map((p) => p.id)

    // Determine period based on frequency
    let period: 'daily' | 'weekly' | 'monthly' = 'daily'
    if (owner.aiReportFrequency === 'weekly') {
      period = 'weekly'
    } else if (owner.aiReportFrequency === 'daily') {
      period = 'daily'
    }

    // Generate AI newsletter report for this owner's properties
    let newsletter
    try {
      newsletter = await generateNewsletterReport(period, {
        ownerIds: [ownerId],
        propertyIds: propertyIds.length > 0 ? propertyIds : undefined,
      }, owner.name)
    } catch (error: any) {
      console.error(`Failed to generate AI report for owner ${owner.name}:`, error)
      // Return error with helpful message
      let errorMessage = error.message || 'Failed to generate AI report'
      if (errorMessage.includes('x-api-key') || errorMessage.includes('authentication_error') || errorMessage.includes('401')) {
        errorMessage = 'AI API authentication failed. Please check your API key in Settings → AI Providers.'
      } else if (errorMessage.includes('API key not configured')) {
        errorMessage = 'AI API key is not configured. Please add it in Settings → AI Providers.'
      }
      return { success: false, error: errorMessage }
    }

    // Generate HTML email
    const emailHTML = await generateNewsletterEmailHTML(newsletter)

    // Send email
    const result = await sendEmail({
      to: recipientEmail,
      subject: newsletter.subject,
      html: emailHTML,
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to send email' }
    }

    // Update owner's last sent timestamp and calculate next send time
    const nextSendTime = calculateNextSendTime(
      owner.aiReportFrequency as 'daily' | 'weekly',
      owner.aiReportTime || '08:00'
    )

    await prisma.owner.update({
      where: { id: ownerId },
      data: {
        aiReportLastSent: new Date(),
        aiReportNextSend: nextSendTime,
      },
    })

    return { success: true }
  } catch (error: any) {
    console.error(`Failed to send AI report to owner ${ownerId}:`, error)
    return { success: false, error: error.message || 'Failed to send AI report' }
  }
}

/**
 * Execute all owner AI reports that are due (for cron jobs)
 */
export async function executeOwnerAIReports(): Promise<{
  executed: number
  success: number
  failed: number
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []

  // Find all owners with AI reports enabled and due
  const owners = await prisma.owner.findMany({
    where: {
      aiReportEnabled: true,
      aiReportFrequency: {
        not: 'none',
      },
      OR: [
        { aiReportNextSend: { lte: now } },
        { aiReportNextSend: null },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      aiReportFrequency: true,
      aiReportTime: true,
    },
  })

  let executed = 0
  let success = 0
  let failed = 0

  for (const owner of owners) {
    try {
      executed++
      const result = await sendOwnerAIReport(owner.id)

      if (result.success) {
        success++
        console.log(`✅ AI report sent to owner ${owner.name} (${owner.id})`)
      } else {
        failed++
        errors.push(`Owner ${owner.name}: ${result.error || 'Unknown error'}`)
        console.error(`❌ Failed to send AI report to owner ${owner.name}: ${result.error}`)
      }
    } catch (error: any) {
      failed++
      const errorMsg = `Owner ${owner.name}: ${error.message || 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`❌ Error sending AI report to owner ${owner.name}:`, error)
    }
  }

  return { executed, success, failed, errors }
}

/**
 * Execute all owner AI reports for testing (sends to all enabled owners regardless of nextSend)
 */
export async function executeOwnerAIReportsForTesting(
  period?: 'daily' | 'weekly' | 'monthly' | 'yesterday' | 'last-week' | 'last-month' | 'current-year'
): Promise<{
  executed: number
  success: number
  failed: number
  errors: string[]
}> {
  const errors: string[] = []

  // Find ALL owners with AI reports enabled (for testing, ignore nextSend)
  const owners = await prisma.owner.findMany({
    where: {
      aiReportEnabled: true,
      aiReportFrequency: {
        not: 'none',
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      aiReportFrequency: true,
      aiReportTime: true,
    },
  })

  let executed = 0
  let success = 0
  let failed = 0

  for (const owner of owners) {
    try {
      executed++
      const result = await sendOwnerAIReport(owner.id)

      if (result.success) {
        success++
        console.log(`✅ AI report sent to owner ${owner.name} (${owner.id})`)
      } else {
        failed++
        errors.push(`Owner ${owner.name}: ${result.error || 'Unknown error'}`)
        console.error(`❌ Failed to send AI report to owner ${owner.name}: ${result.error}`)
      }
    } catch (error: any) {
      failed++
      const errorMsg = `Owner ${owner.name}: ${error.message || 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`❌ Error sending AI report to owner ${owner.name}:`, error)
    }
  }

  return { executed, success, failed, errors }
}

/**
 * Calculate next send time based on frequency and preferred time
 */
function calculateNextSendTime(
  frequency: 'daily' | 'weekly',
  preferredTime: string
): Date {
  const now = new Date()
  const [hours, minutes] = preferredTime.split(':').map(Number)
  
  let nextSend = new Date()
  nextSend = setHours(nextSend, hours)
  nextSend = setMinutes(nextSend, minutes)
  nextSend = startOfDay(nextSend)
  nextSend.setHours(hours, minutes, 0, 0)

  if (frequency === 'daily') {
    // If the time has passed today, schedule for tomorrow
    if (nextSend <= now) {
      nextSend = addDays(nextSend, 1)
    }
  } else if (frequency === 'weekly') {
    // Schedule for next week (7 days from now)
    if (nextSend <= now) {
      nextSend = addWeeks(nextSend, 1)
    } else {
      // If today's time hasn't passed, use it; otherwise next week
      const daysUntilNext = Math.ceil((nextSend.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilNext > 7) {
        nextSend = addWeeks(nextSend, -1)
      }
    }
  }

  return nextSend
}

/**
 * Initialize next send time for an owner (call when preferences are updated)
 */
export async function initializeOwnerAIReportSchedule(ownerId: string): Promise<void> {
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: {
      aiReportEnabled: true,
      aiReportFrequency: true,
      aiReportTime: true,
    },
  })

  if (!owner || !owner.aiReportEnabled || !owner.aiReportFrequency || owner.aiReportFrequency === 'none') {
    // Clear next send time if disabled
    await prisma.owner.update({
      where: { id: ownerId },
      data: {
        aiReportNextSend: null,
      },
    })
    return
  }

  const nextSendTime = calculateNextSendTime(
    owner.aiReportFrequency as 'daily' | 'weekly',
    owner.aiReportTime || '08:00'
  )

  await prisma.owner.update({
    where: { id: ownerId },
    data: {
      aiReportNextSend: nextSendTime,
    },
  })
}

