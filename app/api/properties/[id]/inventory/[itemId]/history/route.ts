import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, itemId } = await params

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        Property: {
          select: {
            ownerId: true,
            managerId: true,
          },
        },
      },
    })

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    if (inventoryItem.propertyId !== id) {
      return NextResponse.json(
        { error: 'Inventory item does not belong to this property' },
        { status: 400 }
      )
    }

    // Check permissions
    const canAccess =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && inventoryItem.Property.managerId === user.id) ||
      (user.role === 'OWNER' && inventoryItem.Property.ownerId === user.ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const history = await prisma.inventoryHistory.findMany({
      where: { inventoryItemId: itemId },
      include: {
        ChangedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Last 50 changes
    })

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('Failed to fetch inventory history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory history' },
      { status: 500 }
    )
  }
}

