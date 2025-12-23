import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { TaskType, TaskStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const where: any = {}
    
    // Owners can only see tasks for their properties
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'No owner linked' }, { status: 403 })
      }
      // Get owner's property IDs
      const ownerProperties = await prisma.property.findMany({
        where: { ownerId: user.ownerId },
        select: { id: true },
      })
      const propertyIds = ownerProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json([])
      }
      where.propertyId = { in: propertyIds }
      // If specific property requested, verify it belongs to owner
      if (propertyId && propertyIds.includes(propertyId)) {
        where.propertyId = propertyId
      } else if (propertyId && !propertyIds.includes(propertyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (user.role === 'MANAGER') {
      // Managers can only see tasks for their assigned properties
      const assignedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const propertyIds = assignedProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json([])
      }
      where.propertyId = { in: propertyIds }
      if (propertyId && propertyIds.includes(propertyId)) {
        where.propertyId = propertyId
      } else if (propertyId && !propertyIds.includes(propertyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Admins can filter by property
      if (propertyId) where.propertyId = propertyId
    }
    
    if (status) where.status = status as TaskStatus
    if (type) where.type = type as TaskType

    const tasks = await prisma.task.findMany({
      where,
      include: {
        Property: true,
        Booking: true,
      },
      orderBy: { dueAt: 'asc' },
      take: 100,
    })

    return NextResponse.json(tasks)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const {
      propertyId,
      bookingId,
      type,
      title,
      description,
      assignedToUserId,
      scheduledAt,
      dueAt,
      costEstimate,
    } = body

    const task = await prisma.task.create({
      data: {
        id: crypto.randomUUID(),
        propertyId,
        bookingId,
        type: type as TaskType,
        title,
        description,
        assignedToUserId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        dueAt: dueAt ? new Date(dueAt) : null,
        costEstimate,
        status: TaskStatus.PENDING,
        updatedAt: new Date(),
      },
      include: {
        Property: true,
        Booking: true,
      },
    })

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { ownerId: true },
      })
      
      executeWorkflows('TASK_CREATED', {
        entityType: 'task',
        entityId: task.id,
        entityData: task,
        propertyId,
        ownerId: property?.ownerId,
      }).catch((err) => {
        console.error('Failed to execute workflows for task creation:', err)
      })
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    )
  }
}

