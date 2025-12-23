import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint - no authentication required
export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'APP_FAVICON' },
    })

    const faviconUrl = setting?.value || '/favicon.ico' // Default to Next.js favicon

    return NextResponse.json({ faviconUrl })
  } catch (error) {
    console.error('Failed to fetch favicon:', error)
    return NextResponse.json(
      { faviconUrl: '/favicon.ico' }, // Default fallback
      { status: 200 }
    )
  }
}

