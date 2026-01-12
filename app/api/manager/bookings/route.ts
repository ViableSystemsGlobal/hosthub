import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isManager } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get properties assigned to this manager
    const assignedProperties = await prisma.property.findMany({
      where: {
        managerId: user.id,
      },
      select: {
        id: true,
      },
    })

    const propertyIds = assignedProperties.map(p => p.id)

    if (propertyIds.length === 0) {
      return NextResponse.json([])
    }

    // Get bookings for assigned properties
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
      },
      include: {
        Property: true,
        Owner: true,
      },
      orderBy: { checkInDate: 'desc' },
      take: 100,
    })

    return NextResponse.json(bookings)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

