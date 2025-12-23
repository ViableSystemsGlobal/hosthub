import { NextRequest, NextResponse } from 'next/server'
import { generateInsight } from '@/lib/ai/service'
import { requireAuth } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const body = await request.json()
    const { pageType, context, ownerId, propertyId } = body

    // Determine currency based on page type
    let currency = 'GHS' // Default
    if (pageType === 'property_page' && propertyId) {
      // Fetch property currency
      const { prisma } = await import('@/lib/prisma')
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { currency: true },
      })
      currency = property?.currency || 'GHS'
    } else if (pageType === 'owner_dashboard' && ownerId) {
      // For owner dashboard, use the most common currency from their properties
      const { prisma } = await import('@/lib/prisma')
      const owner = await prisma.owner.findUnique({
        where: { id: ownerId },
        include: {
          Property: {
            select: { currency: true },
          },
        },
      })
      if (owner?.Property && owner.Property.length > 0) {
        const currencies = owner.Property.map(p => p.currency)
        const currencyCounts = currencies.reduce((acc, curr) => {
          acc[curr] = (acc[curr] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        currency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'GHS'
      }
    }
    // For admin_dashboard, default to GHS (all metrics are converted to GHS)

    const insight = await generateInsight(
      pageType,
      context,
      ownerId || (user.role === 'OWNER' ? user.ownerId : undefined),
      propertyId,
      currency
    )

    return NextResponse.json(insight)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    )
  }
}

