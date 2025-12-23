/**
 * Diagnostic script to check notifications and AI functionality
 * Run this to verify everything is configured correctly
 */

import { prisma } from '../prisma'
import { getAIConfig } from '../ai/providers'
import { sendSMS } from '../notifications/sms'
import { sendEmail } from '../notifications/email'

export interface DiagnosticResult {
  category: string
  check: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
}

export async function checkNotificationsAndAI(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // Check SMS Configuration
  try {
    const smsSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['DEYWURO_USERNAME', 'DEYWURO_PASSWORD', 'SMS_ENABLED'],
        },
      },
    })

    const smsSettingsMap: Record<string, string> = {}
    smsSettings.forEach((s) => {
      smsSettingsMap[s.key] = s.value
    })

    const hasSmsCredentials = !!(smsSettingsMap.DEYWURO_USERNAME && smsSettingsMap.DEYWURO_PASSWORD)
    const smsEnabled = smsSettingsMap.SMS_ENABLED !== 'false'

    results.push({
      category: 'SMS',
      check: 'SMS Configuration',
      status: hasSmsCredentials ? 'pass' : 'fail',
      message: hasSmsCredentials
        ? 'SMS credentials are configured'
        : 'SMS credentials are missing. Configure in Settings → SMS (Deywuro)',
      details: {
        hasUsername: !!smsSettingsMap.DEYWURO_USERNAME,
        hasPassword: !!smsSettingsMap.DEYWURO_PASSWORD,
        enabled: smsEnabled,
      },
    })
  } catch (error: any) {
    results.push({
      category: 'SMS',
      check: 'SMS Configuration',
      status: 'fail',
      message: `Failed to check SMS configuration: ${error.message}`,
    })
  }

  // Check Email Configuration
  try {
    const emailSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_ENABLED'],
        },
      },
    })

    const emailSettingsMap: Record<string, string> = {}
    emailSettings.forEach((s) => {
      emailSettingsMap[s.key] = s.value
    })

    const hasEmailCredentials =
      !!(emailSettingsMap.SMTP_HOST && emailSettingsMap.SMTP_USER && emailSettingsMap.SMTP_PASSWORD)
    const emailEnabled = emailSettingsMap.EMAIL_ENABLED !== 'false'

    results.push({
      category: 'Email',
      check: 'Email Configuration',
      status: hasEmailCredentials ? 'pass' : 'fail',
      message: hasEmailCredentials
        ? 'Email credentials are configured'
        : 'Email credentials are incomplete. Configure in Settings → Email (SMTP)',
      details: {
        hasHost: !!emailSettingsMap.SMTP_HOST,
        hasUser: !!emailSettingsMap.SMTP_USER,
        hasPassword: !!emailSettingsMap.SMTP_PASSWORD,
        enabled: emailEnabled,
      },
    })
  } catch (error: any) {
    results.push({
      category: 'Email',
      check: 'Email Configuration',
      status: 'fail',
      message: `Failed to check email configuration: ${error.message}`,
    })
  }

  // Check AI Configuration
  try {
    const aiConfig = await getAIConfig()
    results.push({
      category: 'AI',
      check: 'AI Provider Configuration',
      status: 'pass',
      message: `AI provider configured: ${aiConfig.provider}${aiConfig.model ? ` (${aiConfig.model})` : ''}`,
      details: {
        provider: aiConfig.provider,
        model: aiConfig.model,
        hasApiKey: !!aiConfig.apiKey,
      },
    })
  } catch (error: any) {
    results.push({
      category: 'AI',
      check: 'AI Provider Configuration',
      status: 'fail',
      message: `AI configuration error: ${error.message}`,
    })
  }

  // Check Notification Settings
  try {
    const notificationSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'NOTIFY_ON_BOOKING_CREATED',
            'NOTIFY_ON_BOOKING_UPDATED',
            'NOTIFY_ON_ISSUE_CREATED',
            'NOTIFY_ON_ISSUE_ASSIGNED',
            'NOTIFY_ON_ISSUE_STATUS_CHANGED',
          ],
        },
      },
    })

    const enabledNotifications = notificationSettings.filter((s) => s.value === 'true')
    results.push({
      category: 'Notifications',
      check: 'Notification Preferences',
      status: enabledNotifications.length > 0 ? 'pass' : 'warning',
      message: `${enabledNotifications.length} notification types are enabled`,
      details: {
        enabled: enabledNotifications.map((s) => s.key),
        total: notificationSettings.length,
      },
    })
  } catch (error: any) {
    results.push({
      category: 'Notifications',
      check: 'Notification Preferences',
      status: 'fail',
      message: `Failed to check notification settings: ${error.message}`,
    })
  }

  // Check if owners have contact info
  try {
    const allOwners = await prisma.owner.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        whatsappNumber: true,
      },
    })

    const ownersWithContact = allOwners.filter(
      (owner) => owner.email || owner.phoneNumber || owner.whatsappNumber
    )
    const ownersWithoutContact = allOwners.length - ownersWithContact.length

    results.push({
      category: 'Notifications',
      check: 'Owner Contact Information',
      status: ownersWithoutContact === 0 ? 'pass' : 'warning',
      message: `${ownersWithContact.length} owners have contact info, ${ownersWithoutContact} owners missing contact info`,
      details: {
        withContact: ownersWithContact.length,
        withoutContact: ownersWithoutContact,
      },
    })
  } catch (error: any) {
    results.push({
      category: 'Notifications',
      check: 'Owner Contact Information',
      status: 'fail',
      message: `Failed to check owner contact info: ${error.message}`,
    })
  }

  // Check recent notifications
  try {
    const recentNotifications = await prisma.notification.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        channel: true,
        status: true,
        createdAt: true,
        errorMessage: true,
      },
    })

    const failedNotifications = recentNotifications.filter((n) => n.status === 'FAILED')
    results.push({
      category: 'Notifications',
      check: 'Recent Notification Status',
      status: failedNotifications.length === 0 ? 'pass' : 'warning',
      message: `Last 10 notifications: ${recentNotifications.length - failedNotifications.length} sent, ${failedNotifications.length} failed`,
      details: {
        total: recentNotifications.length,
        sent: recentNotifications.filter((n) => n.status === 'SENT').length,
        failed: failedNotifications.length,
        pending: recentNotifications.filter((n) => n.status === 'PENDING').length,
        recentFailures: failedNotifications.slice(0, 3).map((n) => ({
          type: n.type,
          channel: n.channel,
          error: n.errorMessage,
        })),
      },
    })
  } catch (error: any) {
    results.push({
      category: 'Notifications',
      check: 'Recent Notification Status',
      status: 'fail',
      message: `Failed to check recent notifications: ${error.message}`,
    })
  }

  // Check AI cache
  try {
    const aiCacheCount = await prisma.aiInsightCache.count()
    const expiredCache = await prisma.aiInsightCache.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    results.push({
      category: 'AI',
      check: 'AI Cache Status',
      status: 'pass',
      message: `${aiCacheCount} cached insights, ${expiredCache} expired`,
      details: {
        total: aiCacheCount,
        expired: expiredCache,
        active: aiCacheCount - expiredCache,
      },
    })
  } catch (error: any) {
    results.push({
      category: 'AI',
      check: 'AI Cache Status',
      status: 'fail',
      message: `Failed to check AI cache: ${error.message}`,
    })
  }

  // Check Owner AI Reports Configuration
  try {
    const ownersWithAIReports = await prisma.owner.findMany({
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
        aiReportEnabled: true,
        aiReportFrequency: true,
        aiReportTime: true,
        aiReportLastSent: true,
        aiReportNextSend: true,
        User: {
          select: {
            email: true,
          },
        },
      },
    })

    const ownersWithoutEmail = ownersWithAIReports.filter(
      (owner) => !owner.User?.email && !owner.email
    )

    results.push({
      category: 'AI Reports',
      check: 'Owner AI Report Configuration',
      status: ownersWithAIReports.length > 0 ? 'pass' : 'warning',
      message: `${ownersWithAIReports.length} owners have AI reports enabled${ownersWithoutEmail.length > 0 ? `, ${ownersWithoutEmail.length} missing email` : ''}`,
      details: {
        enabled: ownersWithAIReports.length,
        withoutEmail: ownersWithoutEmail.length,
        owners: ownersWithAIReports.map((o) => ({
          name: o.name,
          frequency: o.aiReportFrequency,
          time: o.aiReportTime,
          hasEmail: !!(o.User?.email || o.email),
          lastSent: o.aiReportLastSent,
          nextSend: o.aiReportNextSend,
        })),
      },
    })

    // Check if any reports are due
    const now = new Date()
    const dueReports = ownersWithAIReports.filter(
      (owner) => !owner.aiReportNextSend || owner.aiReportNextSend <= now
    )

    if (dueReports.length > 0) {
      results.push({
        category: 'AI Reports',
        check: 'Due AI Reports',
        status: 'warning',
        message: `${dueReports.length} owner(s) have AI reports due to be sent`,
        details: {
          due: dueReports.length,
          owners: dueReports.map((o) => ({
            name: o.name,
            nextSend: o.aiReportNextSend,
            lastSent: o.aiReportLastSent,
          })),
        },
      })
    }
  } catch (error: any) {
    results.push({
      category: 'AI Reports',
      check: 'Owner AI Report Configuration',
      status: 'fail',
      message: `Failed to check AI report configuration: ${error.message}`,
    })
  }

  return results
}

