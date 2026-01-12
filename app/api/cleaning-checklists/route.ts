import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const includeGlobal = searchParams.get('includeGlobal') !== 'false'

    const where: any = {}

    if (propertyId) {
      where.OR = [
        { propertyId },
        ...(includeGlobal ? [{ propertyId: null }] : []),
      ]
    } else if (!includeGlobal) {
      where.propertyId = { not: null }
    }

    const checklists = await prisma.cleaningChecklist.findMany({
      where,
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json(checklists)
  } catch (error: any) {
    console.error('Failed to fetch cleaning checklists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cleaning checklists' },
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

    // Only managers and admins can create checklists
    if (!['MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, items, propertyId, isDefault } = body

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Name and items array are required' },
        { status: 400 }
      )
    }

    // Verify property access if propertyId is provided
    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { managerId: true },
      })

      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 })
      }

      if (user.role === 'MANAGER' && property.managerId !== user.id) {
        return NextResponse.json(
          { error: 'You can only create checklists for properties you manage' },
          { status: 403 }
        )
      }
    }

    // If setting as default, unset other defaults for this property/global
    if (isDefault) {
      await prisma.cleaningChecklist.updateMany({
        where: {
          propertyId: propertyId || null,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const checklist = await prisma.cleaningChecklist.create({
      data: {
        id: crypto.randomUUID(),
        propertyId: propertyId || null,
        name,
        items,
        isDefault: isDefault || false,
        isActive: true,
        createdById: user.id,
        updatedAt: new Date(),
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(checklist, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create cleaning checklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create cleaning checklist' },
      { status: 500 }
    )
  }
}

