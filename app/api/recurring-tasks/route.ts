import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { TaskType } from '@prisma/client'

const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
const VALID_DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const ownerId = searchParams.get('ownerId')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (propertyId) where.propertyId = propertyId
    if (ownerId) where.ownerId = ownerId
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Check if RecurringTask model exists
    if (!(prisma as any).recurringTask) {
      return NextResponse.json(
        { error: 'RecurringTask model not available. Please restart the server after running: npx prisma generate' },
        { status: 500 }
      )
    }

    const recurringTasks = await (prisma as any).recurringTask.findMany({
      where,
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
      orderBy: [
        { nextRunDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json(recurringTasks)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch recurring tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring tasks' },
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

    if (!['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      propertyId,
      ownerId,
      type,
      title,
      description,
      assignedToUserId,
      frequency,
      interval = 1,
      dayOfWeek,
      dayOfMonth,
      startDate,
      endDate,
      costEstimate,
      isActive = true,
    } = body

    // Validate required fields
    if (!title || !frequency || !startDate) {
      return NextResponse.json(
        { error: 'Title, frequency, and start date are required' },
        { status: 400 }
      )
    }

    if (!propertyId && !ownerId) {
      return NextResponse.json(
        { error: 'Either propertyId or ownerId is required' },
        { status: 400 }
      )
    }

    // Validate frequency
    if (!VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency' },
        { status: 400 }
      )
    }

    // Validate day of week if provided
    if (dayOfWeek && !VALID_DAYS_OF_WEEK.includes(dayOfWeek)) {
      return NextResponse.json(
        { error: 'Invalid day of week' },
        { status: 400 }
      )
    }

    // Validate day of month if provided
    if (dayOfMonth && (dayOfMonth < 1 || dayOfMonth > 31)) {
      return NextResponse.json(
        { error: 'Day of month must be between 1 and 31' },
        { status: 400 }
      )
    }

    // Calculate next run date based on frequency
    const start = new Date(startDate)
    let nextRunDate = new Date(start)
    
    // If it's a weekly task with a specific day, calculate the first occurrence
    if (frequency === 'WEEKLY' && dayOfWeek) {
      const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
      const targetDay = daysOfWeek.indexOf(dayOfWeek)
      const currentDay = start.getDay()
      
      let daysToAdd = (targetDay - currentDay + 7) % 7
      if (daysToAdd === 0) daysToAdd = 7 // If today is the day, schedule for next week
      nextRunDate.setDate(start.getDate() + daysToAdd)
    } else if ((frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'YEARLY') && dayOfMonth) {
      // Set to the specified day of month
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
      nextRunDate.setDate(Math.min(dayOfMonth, daysInMonth))
    }

    // Check if RecurringTask model exists
    if (!(prisma as any).recurringTask) {
      return NextResponse.json(
        { error: 'RecurringTask model not available. Please restart the server after running: npx prisma generate' },
        { status: 500 }
      )
    }

    const recurringTask = await (prisma as any).recurringTask.create({
      data: {
        id: crypto.randomUUID(),
        propertyId: propertyId || null,
        ownerId: ownerId || null,
        type: type as TaskType,
        title,
        description: description || null,
        assignedToUserId: assignedToUserId || null,
        frequency,
        interval,
        dayOfWeek: dayOfWeek || null,
        dayOfMonth: dayOfMonth || null,
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        nextRunDate,
        isActive,
        costEstimate: costEstimate || null,
        createdById: user.id,
      },
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

    return NextResponse.json(recurringTask, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create recurring task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create recurring task' },
      { status: 500 }
    )
  }
}

