import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
// Import ContactType from Prisma - using string literals for compatibility
type ContactType = 'MAINTENANCE' | 'PLUMBING' | 'ELECTRICAL' | 'CLEANING' | 'HVAC' | 'GENERAL' | 'OTHER'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const ownerId = searchParams.get('ownerId')
    const type = searchParams.get('type')
    const companyOnly = searchParams.get('companyOnly') === 'true'

    const where: any = {}

    // If companyOnly is true, show only company contacts (no ownerId)
    if (companyOnly) {
      where.ownerId = null
    } else if (ownerId) {
      // Show contacts for specific owner
      where.ownerId = ownerId
      
      // Verify owner exists and user has access
      if (user.role === 'OWNER' && user.ownerId !== ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Show all contacts (admin/manager view)
      if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (type) {
      where.type = type
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        Owner: {
          select: {
            id: true,
            name: true,
            email: true,
            Property: {
              select: {
                id: true,
                name: true,
                nickname: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(contacts, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Failed to fetch contacts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contacts' },
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

    const body = await request.json()
    const { ownerId, name, phoneNumber, email, type, company, notes } = body

    if (!name || !phoneNumber) {
      return NextResponse.json(
        { error: 'Name and phone number are required' },
        { status: 400 }
      )
    }

    // If ownerId is provided, verify access
    if (ownerId) {
      const owner = await prisma.owner.findUnique({
        where: { id: ownerId },
      })

      if (!owner) {
        return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
      }

      // Owners can only create contacts for themselves
      if (user.role === 'OWNER' && user.ownerId !== ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Company contacts can only be created by admins/managers
      if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER'].includes(user.role)) {
        return NextResponse.json(
          { error: 'Only admins and managers can create company contacts' },
          { status: 403 }
        )
      }
    }

    const contact = await prisma.contact.create({
      data: {
        id: crypto.randomUUID(),
        ownerId: ownerId || null,
        name,
        phoneNumber,
        email: email || null,
        type: type || 'GENERAL',
        company: company || null,
        notes: notes || null,
        updatedAt: new Date(),
      },
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

    return NextResponse.json(contact, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create contact' },
      { status: 500 }
    )
  }
}

