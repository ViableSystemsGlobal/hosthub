import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only managers and admins can update checklists
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, items, propertyId, isDefault, isActive } = body

    const existingChecklist = await prisma.cleaningChecklist.findUnique({
      where: { id },
      include: {
        Property: {
          select: { managerId: true },
        },
      },
    })

    if (!existingChecklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER') {
      if (existingChecklist.propertyId && existingChecklist.Property?.managerId !== user.id) {
        return NextResponse.json(
          { error: 'You can only update checklists for properties you manage' },
          { status: 403 }
        )
      }
    }

    // If setting as default, unset other defaults for this property/global
    if (isDefault && !existingChecklist.isDefault) {
      await prisma.cleaningChecklist.updateMany({
        where: {
          id: { not: id },
          propertyId: propertyId !== undefined ? (propertyId || null) : existingChecklist.propertyId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const updated = await prisma.cleaningChecklist.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(items !== undefined && { items }),
        ...(propertyId !== undefined && { propertyId: propertyId || null }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
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

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Failed to update cleaning checklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update cleaning checklist' },
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

    // Only managers and admins can delete checklists
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existingChecklist = await prisma.cleaningChecklist.findUnique({
      where: { id },
      include: {
        Property: {
          select: { managerId: true },
        },
      },
    })

    if (!existingChecklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER') {
      if (existingChecklist.propertyId && existingChecklist.Property?.managerId !== user.id) {
        return NextResponse.json(
          { error: 'You can only delete checklists for properties you manage' },
          { status: 403 }
        )
      }
    }

    await prisma.cleaningChecklist.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete cleaning checklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete cleaning checklist' },
      { status: 500 }
    )
  }
}

