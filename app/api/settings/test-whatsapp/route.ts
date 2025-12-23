import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

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
    const { phoneNumber, message, credentials } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    if (!credentials?.accountSid || !credentials?.authToken || !credentials?.fromNumber) {
      return NextResponse.json(
        { error: 'Twilio credentials are required (Account SID, Auth Token, and WhatsApp Number)' },
        { status: 400 }
      )
    }

    const testMessage = message || 'Hello! This is a test WhatsApp message from HostHub. Your WhatsApp integration is working correctly! 🎉'

    const result = await sendWhatsApp(
      phoneNumber,
      testMessage,
      {},
      {
        accountSid: credentials.accountSid,
        authToken: credentials.authToken,
        fromNumber: credentials.fromNumber,
        whatsappEnabled: credentials.whatsappEnabled !== false,
      }
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test WhatsApp message sent successfully to ${phoneNumber}`,
        messageId: result.messageId,
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send test WhatsApp message' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Failed to send test WhatsApp:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test WhatsApp' },
      { status: 500 }
    )
  }
}

