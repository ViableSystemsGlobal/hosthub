import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { TaskType } from '@prisma/client'

const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
const VALID_DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params

    // Check if RecurringTask model exists
    if (!(prisma as any).recurringTask) {
      return NextResponse.json(
        { error: 'RecurringTask model not available. Please restart the server after running: npx prisma generate' },
        { status: 500 }
      )
    }

    const recurringTask = await (prisma as any).recurringTask.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        Owner: {
          select: {
            id: true,
            name: true,
          },
        },
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        GeneratedTasks: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!recurringTask) {
      return NextResponse.json({ error: 'Recurring task not found' }, { status: 404 })
    }

    return NextResponse.json(recurringTask)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch recurring task:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recurring task' },
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

    if (!['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      propertyId,
      ownerId,
      type,
      title,
      description,
      assignedToUserId,
      frequency,
      interval,
      dayOfWeek,
      dayOfMonth,
      startDate,
      endDate,
      costEstimate,
      isActive,
    } = body

    // Validate if provided
    if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency' },
        { status: 400 }
      )
    }

    if (dayOfWeek && !VALID_DAYS_OF_WEEK.includes(dayOfWeek)) {
      return NextResponse.json(
        { error: 'Invalid day of week' },
        { status: 400 }
      )
    }

    if (dayOfMonth !== undefined && (dayOfMonth < 1 || dayOfMonth > 31)) {
      return NextResponse.json(
        { error: 'Day of month must be between 1 and 31' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type as TaskType
    if (assignedToUserId !== undefined) updateData.assignedToUserId = assignedToUserId || null
    if (frequency !== undefined) updateData.frequency = frequency
    if (interval !== undefined) updateData.interval = interval
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek || null
    if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth || null
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (costEstimate !== undefined) updateData.costEstimate = costEstimate || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (propertyId !== undefined) updateData.propertyId = propertyId || null
    if (ownerId !== undefined) updateData.ownerId = ownerId || null

    // Check if RecurringTask model exists
    if (!(prisma as any).recurringTask) {
      return NextResponse.json(
        { error: 'RecurringTask model not available. Please restart the server after running: npx prisma generate' },
        { status: 500 }
      )
    }

    const recurringTask = await (prisma as any).recurringTask.update({
      where: { id },
      data: updateData,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        Owner: {
          select: {
            id: true,
            name: true,
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

    return NextResponse.json(recurringTask)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Recurring task not found' }, { status: 404 })
    }
    console.error('Failed to update recurring task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update recurring task' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params

    // Check if RecurringTask model exists
    if (!(prisma as any).recurringTask) {
      return NextResponse.json(
        { error: 'RecurringTask model not available. Please restart the server after running: npx prisma generate' },
        { status: 500 }
      )
    }

    await (prisma as any).recurringTask.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Recurring task not found' }, { status: 404 })
    }
    console.error('Failed to delete recurring task:', error)
    return NextResponse.json(
      { error: 'Failed to delete recurring task' },
      { status: 500 }
    )
  }
}

