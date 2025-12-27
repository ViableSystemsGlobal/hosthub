import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { sendSMS } from '@/lib/notifications/sms'
import { sendEmail } from '@/lib/notifications/email'
import { generateEmailTemplate } from '@/lib/notifications/email'

// POST request OTP
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { method } = body // "EMAIL" or "SMS"

    if (!method || !['EMAIL', 'SMS'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be EMAIL or SMS' },
        { status: 400 }
      )
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        phoneNumber: true,
        name: true,
      },
    })

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has required contact info
    if (method === 'SMS' && !userRecord.phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS OTP' },
        { status: 400 }
      )
    }

    if (method === 'EMAIL' && !userRecord.email) {
      return NextResponse.json(
        { error: 'Email is required for email OTP' },
        { status: 400 }
      )
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Save OTP to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode,
        otpExpiresAt,
        otpMethod: method,
      },
    })

    // Send OTP
    const userName = userRecord.name || userRecord.email
    const otpMessage = `Your HostHub verification code is: ${otpCode}. This code will expire in 10 minutes.`

    if (method === 'SMS') {
      const result = await sendSMS(userRecord.phoneNumber!, otpMessage)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS' },
          { status: 500 }
        )
      }
    } else {
      const result = await sendEmail({
        to: userRecord.email,
        subject: 'Your HostHub Verification Code',
        html: await generateEmailTemplate(
          'Your HostHub Verification Code',
          `Hello ${userName},<br><br>Your verification code is: <strong>${otpCode}</strong><br><br>This code will expire in 10 minutes.<br><br>If you didn't request this code, please ignore this email.`
        ),
      })
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send email' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent to your ${method === 'SMS' ? 'phone' : 'email'}`,
    })
  } catch (error: any) {
    console.error('OTP request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send OTP' },
      { status: 500 }
    )
  }
}

// PATCH verify OTP and enable/disable
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, enabled } = body

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        otpCode: true,
        otpExpiresAt: true,
        otpEnabled: true,
      },
    })

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If enabling OTP, verify the code
    if (enabled === true) {
      if (!code) {
        return NextResponse.json(
          { error: 'OTP code is required to enable OTP' },
          { status: 400 }
        )
      }

      if (!userRecord.otpCode || !userRecord.otpExpiresAt) {
        return NextResponse.json(
          { error: 'No OTP code found. Please request a new OTP first' },
          { status: 400 }
        )
      }

      if (userRecord.otpCode !== code) {
        return NextResponse.json(
          { error: 'Invalid OTP code' },
          { status: 400 }
        )
      }

      if (new Date() > userRecord.otpExpiresAt) {
        return NextResponse.json(
          { error: 'OTP code has expired. Please request a new one' },
          { status: 400 }
        )
      }

      // Clear OTP code after successful verification
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpEnabled: true,
          otpCode: null,
          otpExpiresAt: null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'OTP enabled successfully',
      })
    } else if (enabled === false) {
      // Disable OTP
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpEnabled: false,
          otpCode: null,
          otpExpiresAt: null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'OTP disabled successfully',
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid request. enabled must be true or false' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('OTP verify error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}

