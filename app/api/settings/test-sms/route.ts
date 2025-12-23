import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { sendSMS } from '@/lib/notifications/sms'

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
    const { phoneNumber, message, credentials } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Use custom message or default test message
    const testMessage = message || 'This is a test SMS from HostHub. Your SMS configuration is working correctly!'

    // Send test SMS
    const result = await sendSMS(phoneNumber, testMessage, {
      username: credentials?.username,
      password: credentials?.password,
      source: credentials?.source,
      smsEnabled: credentials?.smsEnabled,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test SMS sent successfully',
        messageId: result.messageId,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send test SMS',
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Test SMS error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test SMS' },
      { status: 500 }
    )
  }
}
