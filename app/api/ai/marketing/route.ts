import { NextRequest, NextResponse } from 'next/server'
import { generateMarketingStrategy } from '@/lib/ai/service'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { propertyId, portfolio } = body

    if (portfolio) {
      // Portfolio-level strategy
      const properties = await prisma.property.findMany({
        include: {
          Owner: true,
          Booking: {
            take: 10,
            orderBy: { checkInDate: 'desc' },
          },
        },
      })

      const strategy = await generateMarketingStrategy(
        { type: 'portfolio', properties },
        { properties }
      )

      return NextResponse.json(strategy)
    } else if (propertyId) {
      // Property-level strategy
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          Owner: true,
          Booking: {
            take: 10,
            orderBy: { checkInDate: 'desc' },
          },
        },
      })

      if (!property) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        )
      }

      const strategy = await generateMarketingStrategy(property, {
        bookings: property.Booking,
      })

      return NextResponse.json(strategy)
    } else {
      return NextResponse.json(
        { error: 'Property ID or portfolio flag required' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Marketing strategy error:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate marketing strategy',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

