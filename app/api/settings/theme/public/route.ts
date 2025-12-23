import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint - no authentication required
export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'THEME_COLOR' },
    })

    return NextResponse.json({
      themeColor: setting?.value || '#f97316', // Default orange
    })
  } catch (error) {
    console.error('Failed to fetch theme color:', error)
    return NextResponse.json({
      themeColor: '#f97316', // Default orange on error
    })
  }
}

