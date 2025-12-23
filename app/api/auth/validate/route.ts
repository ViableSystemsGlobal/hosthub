import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST - Validate credentials and check OTP status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        otpEnabled: true,
        otpMethod: true,
      },
    }) as { id: string; email: string; password: string | null; otpEnabled: boolean | null; otpMethod: string | null } | null

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password', valid: false },
        { status: 401 }
      )
    }

    // Check password
    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid email or password', valid: false },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password', valid: false },
        { status: 401 }
      )
    }

    // Credentials are valid - return OTP status
    return NextResponse.json({
      valid: true,
      otpEnabled: user.otpEnabled || false,
      otpMethod: user.otpMethod || 'EMAIL',
    })
  } catch (error: any) {
    console.error('Credential validation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to validate credentials', valid: false },
      { status: 500 }
    )
  }
}

