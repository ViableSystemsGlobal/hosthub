import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-helpers'
import { InventoryType, InventoryStatus, UserRole } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireRole(
      [UserRole.MANAGER, UserRole.OPERATIONS, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      request
    )

    const { id, itemId } = await params
    const body = await request.json()
    const {
      name,
      description,
      quantity,
      minimumQuantity,
      unit,
      status,
      notes,
    } = body

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        Property: {
          select: {
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

    // Verify manager can access this property
    if (user.role === 'MANAGER' && inventoryItem.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only update inventory for properties you manage' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (notes !== undefined) updateData.notes = notes || null

    // Update fields based on type
    if (inventoryItem.type === InventoryType.CONSUMABLE) {
      if (quantity !== undefined) updateData.quantity = quantity
      if (minimumQuantity !== undefined) updateData.minimumQuantity = minimumQuantity || null
      if (unit !== undefined) updateData.unit = unit || null
    } else {
      if (status !== undefined) updateData.status = status as InventoryStatus
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: updateData,
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

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to update inventory item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update inventory item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireRole(
      [UserRole.MANAGER, UserRole.OPERATIONS, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      request
    )

    const { id, itemId } = await params

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        Property: {
          select: {
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

    // Verify manager can access this property
    if (user.role === 'MANAGER' && inventoryItem.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete inventory for properties you manage' },
        { status: 403 }
      )
    }

    await prisma.inventoryItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to delete inventory item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete inventory item' },
      { status: 500 }
    )
  }
}

