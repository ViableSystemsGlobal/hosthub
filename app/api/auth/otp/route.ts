import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSMS } from '@/lib/notifications/sms'
import { sendEmail } from '@/lib/notifications/email'
import { generateEmailTemplate } from '@/lib/notifications/email'

// POST - Request OTP for login (no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, method } = body // "EMAIL" or "SMS"

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!method || !['EMAIL', 'SMS'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be EMAIL or SMS' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        name: true,
        otpEnabled: true,
        otpMethod: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if OTP is enabled for this user
    if (!user.otpEnabled) {
      return NextResponse.json(
        { error: 'OTP is not enabled for this user' },
        { status: 400 }
      )
    }

    // Use the user's preferred method if not specified
    const otpMethod = method || user.otpMethod || 'EMAIL'

    // Check if user has required contact info
    if (otpMethod === 'SMS' && !user.phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required for SMS OTP' },
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
        otpMethod: otpMethod,
      },
    })

    // Send OTP
    const userName = user.name || user.email
    const otpMessage = `Your HostHub verification code is: ${otpCode}. This code will expire in 10 minutes.`

    if (otpMethod === 'SMS') {
      const result = await sendSMS(user.phoneNumber!, otpMessage)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS' },
          { status: 500 }
        )
      }
    } else {
      const result = await sendEmail({
        to: user.email,
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
      message: `OTP sent to your ${otpMethod === 'SMS' ? 'phone' : 'email'}`,
      method: otpMethod,
    })
  } catch (error: any) {
    console.error('Login OTP request error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send OTP' },
      { status: 500 }
    )
  }
}

// PATCH - Verify OTP for login (no auth required)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and OTP code are required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        otpCode: true,
        otpExpiresAt: true,
        otpEnabled: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.otpEnabled) {
      return NextResponse.json(
        { error: 'OTP is not enabled for this user' },
        { status: 400 }
      )
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return NextResponse.json(
        { error: 'No OTP code found. Please request a new OTP first' },
        { status: 400 }
      )
    }

    if (user.otpCode !== code) {
      return NextResponse.json(
        { error: 'Invalid OTP code' },
        { status: 400 }
      )
    }

    if (new Date() > user.otpExpiresAt) {
      return NextResponse.json(
        { error: 'OTP code has expired. Please request a new one' },
        { status: 400 }
      )
    }

    // Clear OTP code after successful verification (but keep it enabled)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    })
  } catch (error: any) {
    console.error('Login OTP verify error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}

