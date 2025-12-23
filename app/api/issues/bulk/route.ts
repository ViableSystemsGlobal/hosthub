import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { IssueStatus, IssuePriority } from '@prisma/client'
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
        { error: 'No issue IDs provided' },
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

        const updated = await prisma.issue.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            status: data.status as IssueStatus,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} issue(s)`,
          count: updated.count,
        })

      case 'updatePriority':
        if (!data?.priority) {
          return NextResponse.json(
            { error: 'Priority is required' },
            { status: 400 }
          )
        }

        const priorityUpdated = await prisma.issue.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            priority: data.priority as IssuePriority,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${priorityUpdated.count} issue(s)`,
          count: priorityUpdated.count,
        })

      case 'delete':
        const deleted = await prisma.issue.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} issue(s)`,
          count: deleted.count,
        })

      case 'export':
        const issues = await prisma.issue.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            Property: {
              select: { name: true },
            },
            AssignedContact: {
              select: { name: true, company: true },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        // Generate CSV
        const headers = [
          'ID',
          'Property',
          'Title',
          'Description',
          'Priority',
          'Status',
          'Assigned To',
          'Created At',
        ]

        const rows = issues.map((issue) => [
          issue.id,
          issue.Property?.name || '',
          issue.title,
          issue.description || '',
          issue.priority,
          issue.status,
          issue.AssignedContact?.name || 'Unassigned',
          format(new Date(issue.createdAt), 'yyyy-MM-dd'),
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="issues-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

