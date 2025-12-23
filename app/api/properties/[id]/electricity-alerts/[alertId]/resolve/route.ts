import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only managers and admins can resolve alerts
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, alertId } = await params

    // Verify property access
    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        managerId: true,
      },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only resolve alerts for properties you manage' },
        { status: 403 }
      )
    }

    const alert = await prisma.electricityAlert.findUnique({
      where: { id: alertId },
    })

    if (!alert || alert.propertyId !== id) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    const updatedAlert = await prisma.electricityAlert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json(updatedAlert)
  } catch (error: any) {
    console.error('Failed to resolve electricity alert:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve electricity alert' },
      { status: 500 }
    )
  }
}

