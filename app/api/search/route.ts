import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query.trim().toLowerCase()
    const results: any[] = []

    // Search Properties
    const propertiesWhere: any = {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { nickname: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
      ],
    }

    // Apply role-based filtering
    if (user.role === 'OWNER' && user.ownerId) {
      propertiesWhere.ownerId = user.ownerId
    } else if (user.role === 'MANAGER') {
      propertiesWhere.managerId = user.id
    }

    const properties = await prisma.property.findMany({
      where: propertiesWhere,
      include: {
        Owner: { select: { id: true, name: true } },
      },
      take: 5,
    })

    properties.forEach((property) => {
      results.push({
        type: 'property',
        id: property.id,
        title: property.name,
        subtitle: property.Owner.name,
        url: `/admin/properties/${property.id}`,
        icon: 'Building2',
      })
    })

    // Search Owners (only for admins)
    if (['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role)) {
      const owners = await prisma.owner.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 5,
      })

      owners.forEach((owner) => {
        results.push({
          type: 'owner',
          id: owner.id,
          title: owner.name,
          subtitle: owner.email || owner.phoneNumber || '',
          url: `/admin/owners/${owner.id}`,
          icon: 'Users',
        })
      })
    }

    // Search Bookings
    const bookingsWhere: any = {
      OR: [
        { guestName: { contains: searchTerm, mode: 'insensitive' } },
        { externalReservationCode: { contains: searchTerm, mode: 'insensitive' } },
      ],
    }

    if (user.role === 'OWNER' && user.ownerId) {
      bookingsWhere.ownerId = user.ownerId
    } else if (user.role === 'MANAGER') {
      const assignedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const propertyIds = assignedProperties.map(p => p.id)
      if (propertyIds.length > 0) {
        bookingsWhere.propertyId = { in: propertyIds }
      } else {
        bookingsWhere.propertyId = { in: [] } // No results
      }
    }

    const bookings = await prisma.booking.findMany({
      where: bookingsWhere,
      include: {
        Property: { select: { id: true, name: true } },
        Owner: { select: { id: true, name: true } },
      },
      take: 5,
      orderBy: { checkInDate: 'desc' },
    })

    bookings.forEach((booking) => {
      results.push({
        type: 'booking',
        id: booking.id,
        title: booking.guestName || `Booking ${booking.externalReservationCode || booking.id.slice(0, 8)}`,
        subtitle: `${booking.Property.name} - ${booking.Owner.name}`,
        url: `/admin/bookings/${booking.id}/edit`,
        icon: 'Calendar',
      })
    })

    // Search Issues (for admins and managers)
    if (['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
      const issuesWhere: any = {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      }

      if (user.role === 'MANAGER') {
        const assignedProperties = await prisma.property.findMany({
          where: { managerId: user.id },
          select: { id: true },
        })
        const propertyIds = assignedProperties.map(p => p.id)
        if (propertyIds.length > 0) {
          issuesWhere.propertyId = { in: propertyIds }
        } else {
          issuesWhere.propertyId = { in: [] }
        }
      }

      const issues = await prisma.issue.findMany({
        where: issuesWhere,
        include: {
          Property: { select: { id: true, name: true } },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      })

      issues.forEach((issue) => {
        results.push({
          type: 'issue',
          id: issue.id,
          title: issue.title,
          subtitle: issue.Property.name,
          url: `/admin/issues/${issue.id}`,
          icon: 'AlertTriangle',
        })
      })
    }

    // Search Contacts (for admins)
    if (['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role)) {
      const contacts = await prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
            { company: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 5,
      })

      contacts.forEach((contact) => {
        results.push({
          type: 'contact',
          id: contact.id,
          title: contact.name,
          subtitle: contact.company || contact.phoneNumber || contact.email || '',
          url: `/admin/contacts/${contact.id}`,
          icon: 'Phone',
        })
      })
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search' },
      { status: 500 }
    )
  }
}

