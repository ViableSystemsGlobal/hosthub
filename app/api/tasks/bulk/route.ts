import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.status || 401 }
    )
  }

  try {
    const body = await request.json()
    const { ids, action, data } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No task IDs provided' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'No action specified' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'updateStatus':
        if (!data?.status) {
          return NextResponse.json(
            { error: 'Status is required' },
            { status: 400 }
          )
        }

        const updated = await prisma.task.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            status: data.status as TaskStatus,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} task(s)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.task.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} task(s)`,
          count: deleted.count,
        })

      case 'export':
        const tasks = await prisma.task.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            Property: {
              select: { name: true },
            },
            Booking: {
              select: { guestName: true, checkInDate: true },
            },
          },
          orderBy: {
            dueAt: 'asc',
          },
        })

        // Generate CSV
        const headers = [
          'ID',
          'Property',
          'Title',
          'Type',
          'Status',
          'Due Date',
          'Guest Name',
          'Check-in Date',
        ]

        const rows = tasks.map((task) => [
          task.id,
          task.Property.name,
          task.title,
          task.type,
          task.status,
          task.dueAt ? format(new Date(task.dueAt), 'yyyy-MM-dd') : '',
          task.Booking?.guestName || '',
          task.Booking?.checkInDate ? format(new Date(task.Booking.checkInDate), 'yyyy-MM-dd') : '',
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="tasks-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
          },
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}

