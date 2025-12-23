import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Public endpoint - no authentication required
    const logoSetting = await prisma.setting.findUnique({
      where: { key: 'APP_LOGO' },
    })

    return NextResponse.json({ 
      logoUrl: logoSetting?.value || null 
    })
  } catch (error: any) {
    console.error('Failed to fetch logo:', error)
    return NextResponse.json({ logoUrl: null })
  }
}

