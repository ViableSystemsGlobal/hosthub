import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { sendEmail, generateEmailTemplate } from '@/lib/notifications/email'

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
    const { email, subject, message } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Use custom subject/message or default test email
    const testSubject = subject || 'Test Email from HostHub'
    const testMessage = message || 'This is a test email from HostHub. Your email configuration is working correctly!'
    
    // Generate HTML email template
    const htmlContent = await generateEmailTemplate(
      testSubject,
      `<p>${testMessage}</p>`,
      undefined,
      undefined
    )

    // Send test email
    const result = await sendEmail({
      to: email,
      subject: testSubject,
      html: htmlContent,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send test email',
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    )
  }
}

