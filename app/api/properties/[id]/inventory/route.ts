import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireRole } from '@/lib/auth-helpers'
import { InventoryType, InventoryStatus, UserRole } from '@prisma/client'

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
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as InventoryType | null

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

    const where: any = { propertyId: id }
    if (type) {
      where.type = type
    }

    const inventory = await prisma.inventoryItem.findMany({
      where,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        LastCheckedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(inventory)
  } catch (error: any) {
    console.error('Failed to fetch inventory:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    })
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch inventory',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(
      [UserRole.MANAGER, UserRole.OPERATIONS, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      request
    )

    const { id } = await params
    const body = await request.json()
    const {
      name,
      type,
      description,
      quantity,
      minimumQuantity,
      unit,
      status,
      notes,
    } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

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
        { error: 'You can only add inventory to properties you manage' },
        { status: 403 }
      )
    }

    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        id: crypto.randomUUID(),
        propertyId: id,
        name,
        type: type as InventoryType,
        description: description || null,
        quantity: type === 'CONSUMABLE' ? (quantity || 0) : null,
        minimumQuantity: type === 'CONSUMABLE' ? (minimumQuantity || null) : null,
        unit: type === 'CONSUMABLE' ? (unit || 'pieces') : null,
        status: type === 'STATIONARY' ? (status || InventoryStatus.PRESENT) : InventoryStatus.PRESENT,
        notes: notes || null,
        updatedAt: new Date(),
      },
      include: {
        LastCheckedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(inventoryItem, { status: 201 })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to create inventory item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create inventory item' },
      { status: 500 }
    )
  }
}

