import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    // Test database connection
    const user = await prisma.user.findUnique({
      where: { email: 'admin@hosthub.com' },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Test password
    const passwordMatch = await bcrypt.compare('admin123', user.password)
    
    return NextResponse.json({
      userExists: true,
      email: user.email,
      role: user.role,
      passwordMatch,
      passwordHash: user.password.substring(0, 20) + '...',
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

