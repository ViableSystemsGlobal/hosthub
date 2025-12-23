import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { ReportType, ReportFormat, ReportSchedule } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    // @ts-ignore - Report model may not be in types yet
    const reportModel = (prisma as any).report
    if (!reportModel) {
      return NextResponse.json({ error: 'Report model not available. Please restart the server.' }, { status: 500 })
    }
    const report = await reportModel.findUnique({
      where: { id },
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

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json(report)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch report' },
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

    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      description,
      schedule,
      scheduleDay,
      scheduleTime,
      filters,
      emailRecipients,
      isActive,
    } = body

    // Calculate next run time if schedule changed
    let nextRunAt: Date | null | undefined = undefined
    if (schedule !== undefined && schedule !== 'NONE' && scheduleTime) {
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

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (schedule !== undefined) updateData.schedule = schedule
    if (scheduleDay !== undefined) updateData.scheduleDay = scheduleDay
    if (scheduleTime !== undefined) updateData.scheduleTime = scheduleTime
    if (filters !== undefined) updateData.filters = filters
    if (emailRecipients !== undefined) updateData.emailRecipients = emailRecipients
    if (isActive !== undefined) updateData.isActive = isActive
    if (nextRunAt !== undefined) updateData.nextRunAt = nextRunAt

    // @ts-ignore - Report model may not be in types yet
    const reportModel = (prisma as any).report
    if (!reportModel) {
      return NextResponse.json({ error: 'Report model not available. Please restart the server.' }, { status: 500 })
    }
    const report = await reportModel.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('Failed to update report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update report' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    // @ts-ignore - Report model may not be in types yet
    const reportModel = (prisma as any).report
    if (!reportModel) {
      return NextResponse.json({ error: 'Report model not available. Please restart the server.' }, { status: 500 })
    }
    await reportModel.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to delete report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete report' },
      { status: 500 }
    )
  }
}

