import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { GuestContactType, GuestContactStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins, managers, and operations can view guest contacts
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const propertyId = searchParams.get('propertyId')
    const search = searchParams.get('search') // Search by name, email, or phone

    const where: any = {}

    if (type) {
      where.type = type as GuestContactType
    }

    if (status) {
      // Handle comma-separated status values
      const statusValues = status.split(',').map(s => s.trim())
      if (statusValues.length === 1) {
        where.status = statusValues[0] as GuestContactStatus
      } else {
        where.status = { in: statusValues as GuestContactStatus[] }
      }
    }

    if (propertyId) {
      where.propertyId = propertyId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Managers can only see guest contacts for their assigned properties
    if (user.role === 'MANAGER') {
      const assignedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const propertyIds = assignedProperties.map(p => p.id)
      if (propertyIds.length > 0) {
        where.propertyId = { in: propertyIds }
      } else {
        // Manager has no assigned properties, return empty
        return NextResponse.json([])
      }
    }

    const guestContacts = await prisma.guestContact.findMany({
      where,
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
          select: {
            id: true,
            checkInDate: true,
            checkOutDate: true,
            status: true,
          },
          orderBy: {
            checkInDate: 'desc',
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(guestContacts)
  } catch (error: any) {
    console.error('Failed to fetch guest contacts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guest contacts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins, managers, and operations can create guest contacts
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      email,
      phoneNumber,
      type = 'LEAD',
      status = 'NEW',
      source,
      propertyId,
      notes,
      followUpDate,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // If propertyId is provided, verify access
    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      })

      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 })
      }

      // Managers can only create contacts for their assigned properties
      if (user.role === 'MANAGER' && property.managerId !== user.id) {
        return NextResponse.json(
          { error: 'You can only create guest contacts for properties you manage' },
          { status: 403 }
        )
      }
    }

    const guestContact = await prisma.guestContact.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email: email || null,
        phoneNumber: phoneNumber || null,
        type: type as GuestContactType,
        status: status as GuestContactStatus,
        source: source || null,
        propertyId: propertyId || null,
        notes: notes || null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        createdById: user.id,
        updatedAt: new Date(),
      },
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

    return NextResponse.json(guestContact, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create guest contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create guest contact' },
      { status: 500 }
    )
  }
}
