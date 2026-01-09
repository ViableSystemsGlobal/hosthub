import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { clearFxRatesCache } from '@/lib/currency'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    const status = error.status || 401
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status }
    )
  }

  try {
    // Fetch all settings from database
    const settings = await prisma.setting.findMany({
      orderBy: { category: 'asc' },
    })

    // Convert to key-value object
    const settingsObj: Record<string, string> = {}
    settings.forEach((setting) => {
      settingsObj[setting.key] = setting.value
    })

    return NextResponse.json(settingsObj)
  } catch (error: any) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    const status = error.status || 401
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status }
    )
  }

  try {

    const body = await request.json()

    // List of all setting keys
    const settingKeys = [
      'DEYWURO_USERNAME',
      'DEYWURO_PASSWORD',
      'DEYWURO_SOURCE',
      'SMS_ENABLED',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_WHATSAPP_NUMBER',
      'WHATSAPP_ENABLED',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_FROM',
      'EMAIL_ENABLED',
      'NOTIFY_ON_ISSUE_CREATED',
      'NOTIFY_ON_ISSUE_ASSIGNED',
      'NOTIFY_ON_ISSUE_STATUS_CHANGED',
      'NOTIFY_ON_ISSUE_COMMENTED',
      'NOTIFY_ON_BOOKING_CREATED',
      'NOTIFY_ON_BOOKING_UPDATED',
      'SEND_SMS_FOR_URGENT_ISSUES',
      'BOOKING_REMINDER_HOURS',
      'TASK_REMINDER_ENABLED',
      'ISSUE_REMINDER_ENABLED',
      'PAYMENT_REMINDER_ENABLED',
      'NEXT_PUBLIC_APP_URL',
      'AI_PROVIDER',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'AI_MODEL',
      'APP_LOGO',
      'APP_FAVICON',
      'THEME_COLOR',
      'FX_RATE_GHS',
      'FX_RATE_USD',
    ]

    // Map frontend settings to database keys
    const mapping: Record<string, { key: string; category: string }> = {
      deywuroUsername: { key: 'DEYWURO_USERNAME', category: 'sms' },
      deywuroPassword: { key: 'DEYWURO_PASSWORD', category: 'sms' },
      deywuroSource: { key: 'DEYWURO_SOURCE', category: 'sms' },
      smsEnabled: { key: 'SMS_ENABLED', category: 'sms' },
      twilioAccountSid: { key: 'TWILIO_ACCOUNT_SID', category: 'whatsapp' },
      twilioAuthToken: { key: 'TWILIO_AUTH_TOKEN', category: 'whatsapp' },
      twilioWhatsAppNumber: { key: 'TWILIO_WHATSAPP_NUMBER', category: 'whatsapp' },
      whatsappEnabled: { key: 'WHATSAPP_ENABLED', category: 'whatsapp' },
      smtpHost: { key: 'SMTP_HOST', category: 'email' },
      smtpPort: { key: 'SMTP_PORT', category: 'email' },
      smtpUser: { key: 'SMTP_USER', category: 'email' },
      smtpPassword: { key: 'SMTP_PASSWORD', category: 'email' },
      smtpFrom: { key: 'SMTP_FROM', category: 'email' },
      emailEnabled: { key: 'EMAIL_ENABLED', category: 'email' },
      notifyOnIssueCreated: { key: 'NOTIFY_ON_ISSUE_CREATED', category: 'notifications' },
      notifyOnIssueAssigned: { key: 'NOTIFY_ON_ISSUE_ASSIGNED', category: 'notifications' },
      notifyOnIssueStatusChanged: { key: 'NOTIFY_ON_ISSUE_STATUS_CHANGED', category: 'notifications' },
      notifyOnIssueCommented: { key: 'NOTIFY_ON_ISSUE_COMMENTED', category: 'notifications' },
      notifyOnBookingCreated: { key: 'NOTIFY_ON_BOOKING_CREATED', category: 'notifications' },
      notifyOnBookingUpdated: { key: 'NOTIFY_ON_BOOKING_UPDATED', category: 'notifications' },
      sendSmsForUrgentIssues: { key: 'SEND_SMS_FOR_URGENT_ISSUES', category: 'notifications' },
      bookingReminderHours: { key: 'BOOKING_REMINDER_HOURS', category: 'reminders' },
      taskReminderEnabled: { key: 'TASK_REMINDER_ENABLED', category: 'reminders' },
      issueReminderEnabled: { key: 'ISSUE_REMINDER_ENABLED', category: 'reminders' },
      paymentReminderEnabled: { key: 'PAYMENT_REMINDER_ENABLED', category: 'reminders' },
      appUrl: { key: 'NEXT_PUBLIC_APP_URL', category: 'general' },
      aiProvider: { key: 'AI_PROVIDER', category: 'ai' },
      openaiApiKey: { key: 'OPENAI_API_KEY', category: 'ai' },
      anthropicApiKey: { key: 'ANTHROPIC_API_KEY', category: 'ai' },
      geminiApiKey: { key: 'GEMINI_API_KEY', category: 'ai' },
      aiModel: { key: 'AI_MODEL', category: 'ai' },
      logo: { key: 'APP_LOGO', category: 'general' },
      favicon: { key: 'APP_FAVICON', category: 'general' },
      themeColor: { key: 'THEME_COLOR', category: 'general' },
      fxRateGHS: { key: 'FX_RATE_GHS', category: 'general' },
      fxRateUSD: { key: 'FX_RATE_USD', category: 'general' },
      fxRateFormat: { key: 'FX_RATE_FORMAT', category: 'general' },
    }

    // Handle FX rate format conversion
    // FX_RATE_GHS is always stored as "1 GHS = X USD" format
    if (body.fxRateGHS !== undefined && body.fxRateFormat !== undefined) {
      const rateValue = parseFloat(body.fxRateGHS as string)
      if (!isNaN(rateValue) && rateValue > 0) {
        // If user entered USD→GHS format (e.g., 11.5), convert to GHS→USD (0.0869)
        if (body.fxRateFormat === 'usdToGhs') {
          body.fxRateGHS = (1 / rateValue).toFixed(6)
        }
        // If user entered GHS→USD format (e.g., 0.0869), keep as is
      }
    }

    // Update or create each setting
    const updates = Object.entries(body).map(async ([frontendKey, value]) => {
      const mappingInfo = mapping[frontendKey]
      if (!mappingInfo) return

      const stringValue = typeof value === 'boolean' ? String(value) : String(value || '')

      await prisma.setting.upsert({
        where: { key: mappingInfo.key },
        update: {
          value: stringValue,
          category: mappingInfo.category,
          updatedAt: new Date(),
        },
        create: {
          key: mappingInfo.key,
          value: stringValue,
          category: mappingInfo.category,
        },
      })
    })

    await Promise.all(updates)

    // Clear FX rates cache when exchange rates are updated
    if (body.fxRateGHS !== undefined || body.fxRateUSD !== undefined || body.fxRateFormat !== undefined) {
      clearFxRatesCache()
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to save settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save settings' },
      { status: 500 }
    )
  }
}

