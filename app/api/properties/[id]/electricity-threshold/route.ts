import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only managers and admins can set thresholds
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { minimumBalance, unit } = body

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
        { error: 'You can only set thresholds for properties you manage' },
        { status: 403 }
      )
    }

    const updatedProperty = await prisma.property.update({
      where: { id },
      data: {
        electricityMeterMinimumBalance: minimumBalance !== undefined ? parseFloat(minimumBalance) : null,
        electricityMeterUnit: unit || 'GHS',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(updatedProperty)
  } catch (error: any) {
    console.error('Failed to update electricity threshold:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update electricity threshold' },
      { status: 500 }
    )
  }
}

