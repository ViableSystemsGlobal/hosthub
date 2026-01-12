import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
// ContactType enum values
const ContactTypes = ['MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANING', 'HVAC', 'GENERAL', 'OTHER'] as const
type ContactType = typeof ContactTypes[number]

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

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        Owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Check permissions
    if (contact.ownerId) {
      if (user.role === 'OWNER' && user.ownerId !== contact.ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Company contact - only admins/managers can view
      if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(contact, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contact' },
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

    const { id } = await params
    const body = await request.json()
    const { name, phoneNumber, email, type, company, notes } = body

    // Get existing contact
    const existingContact = await prisma.contact.findUnique({
      where: { id },
    })

    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Check permissions
    if (existingContact.ownerId) {
      if (user.role === 'OWNER' && user.ownerId !== existingContact.ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Company contact - only admins/managers can edit
      if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber
    if (email !== undefined) updateData.email = email || null
    if (type !== undefined) updateData.type = type
    if (company !== undefined) updateData.company = company || null
    if (notes !== undefined) updateData.notes = notes || null

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        Owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updatedContact)
  } catch (error: any) {
    console.error('Failed to update contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update contact' },
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

    const { id } = await params

    const contact = await prisma.contact.findUnique({
      where: { id },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Check permissions
    if (contact.ownerId) {
      if (user.role === 'OWNER' && user.ownerId !== contact.ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Company contact - only admins/managers can delete
      if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await prisma.contact.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact' },
      { status: 500 }
    )
  }
}

