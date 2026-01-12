import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { GuestContactType, GuestContactStatus } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins, managers, and operations can view guest contacts
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const guestContact = await prisma.guestContact.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
            Owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Booking: {
          include: {
            Property: {
              select: {
                id: true,
                name: true,
                nickname: true,
              },
            },
          },
          orderBy: {
            checkInDate: 'desc',
          },
        },
      },
    })

    if (!guestContact) {
      return NextResponse.json({ error: 'Guest contact not found' }, { status: 404 })
    }

    // Managers can only view guest contacts for their assigned properties
    if (user.role === 'MANAGER' && guestContact.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: guestContact.propertyId },
      })
      if (property?.managerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(guestContact)
  } catch (error: any) {
    console.error('Failed to fetch guest contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guest contact' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins, managers, and operations can update guest contacts
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Check if guest contact exists and verify access
    const existingContact = await prisma.guestContact.findUnique({
      where: { id },
      include: {
        Property: true,
      },
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Guest contact not found' }, { status: 404 })
    }

    // Managers can only update guest contacts for their assigned properties
    if (user.role === 'MANAGER' && existingContact.propertyId) {
      if (existingContact.Property?.managerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // If propertyId is being updated, verify access
    if (body.propertyId && body.propertyId !== existingContact.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: body.propertyId },
      })

      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 })
      }

      if (user.role === 'MANAGER' && property.managerId !== user.id) {
        return NextResponse.json(
          { error: 'You can only assign guest contacts to properties you manage' },
          { status: 403 }
        )
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || null
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber || null
    if (body.type !== undefined) updateData.type = body.type as GuestContactType
    if (body.status !== undefined) updateData.status = body.status as GuestContactStatus
    if (body.source !== undefined) updateData.source = body.source || null
    if (body.propertyId !== undefined) updateData.propertyId = body.propertyId || null
    if (body.notes !== undefined) updateData.notes = body.notes || null
    if (body.followUpDate !== undefined) {
      updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null
    }
    if (body.lastContactedAt !== undefined) {
      updateData.lastContactedAt = body.lastContactedAt ? new Date(body.lastContactedAt) : null
    }

    const guestContact = await prisma.guestContact.update({
      where: { id },
      data: updateData,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(guestContact)
  } catch (error: any) {
    console.error('Failed to update guest contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update guest contact' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and operations can delete guest contacts
    if (!['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const guestContact = await prisma.guestContact.findUnique({
      where: { id },
    })

    if (!guestContact) {
      return NextResponse.json({ error: 'Guest contact not found' }, { status: 404 })
    }

    await prisma.guestContact.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete guest contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete guest contact' },
      { status: 500 }
    )
  }
}
