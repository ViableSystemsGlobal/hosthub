import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify property access
    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        ownerId: true,
        managerId: true,
      },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Check permissions
    const canAccess =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && property.managerId === user.id) ||
      (user.role === 'OWNER' && property.ownerId === user.ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const alerts = await prisma.electricityAlert.findMany({
      where: { propertyId: id },
      include: {
        Reading: {
          include: {
            EnteredBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { alertSentAt: 'desc' },
    })

    return NextResponse.json(alerts)
  } catch (error: any) {
    console.error('Failed to fetch electricity alerts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch electricity alerts' },
      { status: 500 }
    )
  }
}

