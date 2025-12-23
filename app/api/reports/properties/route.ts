import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/reports/properties
 * Fetch all properties with images for report grouping
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const properties = await prisma.property.findMany({
      select: {
        id: true,
        name: true,
        nickname: true,
        photos: true,
      },
    })

    return NextResponse.json(properties)
  } catch (error: any) {
    console.error('Failed to fetch properties:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch properties' },
      { status: error.status || 500 }
    )
  }
}

