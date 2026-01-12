import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { TaskStatus } from '@prisma/client'

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

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        TaskChecklist: {
          include: {
            Checklist: true,
          },
        },
        Property: {
          select: {
            ownerId: true,
            managerId: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions
    const canAccess =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && task.Property.managerId === user.id) ||
      (user.role === 'OWNER' && task.Property.ownerId === user.ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(task.TaskChecklist)
  } catch (error: any) {
    console.error('Failed to fetch task checklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task checklist' },
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

    // Only operations, managers, and admins can update checklists
    if (!['OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { items } = body
    let checklistId = body.checklistId

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            managerId: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && task.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only update checklists for properties you manage' },
        { status: 403 }
      )
    }

    // Check if checklist exists or create it
    let taskChecklist = await prisma.taskChecklist.findUnique({
      where: { taskId: id },
    })

    if (!taskChecklist) {
      // If no checklist exists, we need a checklistId to create one
      if (!checklistId) {
        // Try to find a default checklist for this property
        const property = await prisma.property.findUnique({
          where: { id: task.propertyId },
        })

        if (property) {
          const defaultChecklist = await prisma.cleaningChecklist.findFirst({
            where: {
              OR: [
                { propertyId: property.id, isDefault: true, isActive: true },
                { propertyId: null, isDefault: true, isActive: true },
              ],
            },
            orderBy: [
              { propertyId: 'desc' }, // Prefer property-specific over global
              { createdAt: 'desc' },
            ],
          })

          if (defaultChecklist) {
            checklistId = defaultChecklist.id
            // If no items provided, use items from template
            if (!items || !Array.isArray(items) || items.length === 0) {
              const templateItems = (defaultChecklist.items as any[]) || []
              const formattedItems = templateItems.map((item: any) => ({
                id: item.id || crypto.randomUUID(),
                text: item.text || item,
                completed: false,
              }))
              taskChecklist = await prisma.taskChecklist.create({
                data: {
                  id: crypto.randomUUID(),
                  taskId: id,
                  checklistId: defaultChecklist.id,
                  items: formattedItems,
                  updatedAt: new Date(),
                },
              })
            } else {
              // Use provided items
              taskChecklist = await prisma.taskChecklist.create({
                data: {
                  id: crypto.randomUUID(),
                  taskId: id,
                  checklistId: defaultChecklist.id,
                  items: items,
                  updatedAt: new Date(),
                },
              })
            }
          } else {
            return NextResponse.json(
              { error: 'No default checklist template found. Please create a checklist template first.' },
              { status: 400 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Property not found' },
            { status: 404 }
          )
        }
      } else {
        // Use provided checklistId
        taskChecklist = await prisma.taskChecklist.create({
          data: {
            id: crypto.randomUUID(),
            taskId: id,
            checklistId,
            items: items || [],
            updatedAt: new Date(),
          },
        })
      }
    } else {
      // Update existing checklist
      taskChecklist = await prisma.taskChecklist.update({
        where: { taskId: id },
        data: {
          items: items || taskChecklist.items,
          updatedAt: new Date(),
        },
      })
    }

    // Check if all items are completed
    const checklistItems = taskChecklist.items as any[]
    const allCompleted = checklistItems.every((item: any) => item.completed === true)

    if (allCompleted && checklistItems.length > 0) {
      // Mark checklist as completed
      await prisma.taskChecklist.update({
        where: { taskId: id },
        data: {
          completedAt: new Date(),
          completedById: user.id,
        },
      })

      // Update task checklist completed timestamp
      await prisma.task.update({
        where: { id },
        data: {
          checklistCompletedAt: new Date(),
        },
      })
    }

    const updated = await prisma.taskChecklist.findUnique({
      where: { taskId: id },
      include: {
        Checklist: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Failed to update task checklist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update task checklist' },
      { status: 500 }
    )
  }
}

