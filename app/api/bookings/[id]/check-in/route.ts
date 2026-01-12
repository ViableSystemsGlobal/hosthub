import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { BookingStatus } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only managers, operations, and admins can check in guests
    if (!['MANAGER', 'GENERAL_MANAGER', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { notes } = body

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            managerId: true,
            ownerId: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && booking.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only check in guests for properties you manage' },
        { status: 403 }
      )
    }

    // Can only check in upcoming bookings
    if (booking.status !== BookingStatus.UPCOMING) {
      return NextResponse.json(
        { error: 'Can only check in upcoming bookings' },
        { status: 400 }
      )
    }

    // Check if already checked in
    if (booking.checkedInAt) {
      return NextResponse.json(
        { error: 'Guest already checked in' },
        { status: 400 }
      )
    }

    // Update booking with check-in info
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        checkedInAt: new Date(),
        checkedInById: user.id,
        checkInNotes: notes || null,
        updatedAt: new Date(),
      },
      include: {
        Property: true,
        Owner: true,
        CheckedInBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      executeWorkflows('BOOKING_CHECKED_IN', {
        entityType: 'booking',
        entityId: booking.id,
        entityData: updatedBooking,
        propertyId: booking.propertyId,
        ownerId: booking.ownerId,
      }).catch((err) => {
        console.error('Failed to execute workflows for check-in:', err)
      })
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    return NextResponse.json(updatedBooking)
  } catch (error: any) {
    console.error('Failed to check in guest:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check in guest' },
      { status: 500 }
    )
  }
}

