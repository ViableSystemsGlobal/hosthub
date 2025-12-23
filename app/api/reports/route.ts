import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { ReportType, ReportFormat, ReportSchedule } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (type) {
      where.type = type as ReportType
    }
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // @ts-ignore - Report model may not be in types yet
    const reportModel = (prisma as any).report
    if (!reportModel) {
      return NextResponse.json({ error: 'Report model not available. Please restart the server after running prisma generate.' }, { status: 500 })
    }
    const reports = await reportModel.findMany({
      where,
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(reports)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reports' },
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

    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      type,
      format,
      schedule,
      scheduleDay,
      scheduleTime,
      filters,
      fields,
      grouping,
      sorting,
      comparisons,
      emailRecipients,
      isActive = true,
    } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    // Calculate next run time if scheduled
    let nextRunAt: Date | null = null
    if (schedule && schedule !== 'NONE' && scheduleTime) {
      const now = new Date()
      const [hours, minutes] = scheduleTime.split(':').map(Number)
      
      nextRunAt = new Date()
      nextRunAt.setHours(hours, minutes, 0, 0)

      if (schedule === 'DAILY') {
        if (nextRunAt <= now) {
          nextRunAt.setDate(nextRunAt.getDate() + 1)
        }
      } else if (schedule === 'WEEKLY' && scheduleDay !== undefined) {
        const daysUntilNext = (scheduleDay - now.getDay() + 7) % 7
        nextRunAt.setDate(now.getDate() + (daysUntilNext || 7))
      } else if (schedule === 'MONTHLY' && scheduleDay !== undefined) {
        nextRunAt.setDate(scheduleDay)
        if (nextRunAt <= now) {
          nextRunAt.setMonth(nextRunAt.getMonth() + 1)
        }
      }
    }

    // @ts-ignore - Report model may not be in types yet
    const reportModel = (prisma as any).report || (prisma as any).Report
    if (!reportModel) {
      throw new Error('Report model not available. Please restart the server after running prisma generate.')
    }
    const report = await reportModel.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        type: type as ReportType,
        format: format || ReportFormat.EXCEL,
        schedule: schedule || ReportSchedule.NONE,
        scheduleDay: scheduleDay || null,
        scheduleTime: scheduleTime || null,
        nextRunAt,
        isActive,
        filters: filters || null,
        fields: fields || null,
        grouping: grouping || null,
        sorting: sorting || null,
        comparisons: comparisons || null,
        emailRecipients: emailRecipients || [],
        createdById: user.id,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create report' },
      { status: 500 }
    )
  }
}

