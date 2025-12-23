import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
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
        { error: 'No template IDs provided' },
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
      case 'updateActive':
        if (data?.isActive === undefined) {
          return NextResponse.json(
            { error: 'isActive is required' },
            { status: 400 }
          )
        }

        const updated = await prisma.emailTemplate.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            isActive: data.isActive,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} template(s)`,
          count: updated.count,
        })

      case 'delete':
        // Prevent deletion of default templates
        const templates = await prisma.emailTemplate.findMany({
          where: {
            id: { in: ids },
            isDefault: true,
          },
        })

        if (templates.length > 0) {
          return NextResponse.json(
            { error: 'Cannot delete default templates. Set another template as default first.' },
            { status: 400 }
          )
        }

        const deleted = await prisma.emailTemplate.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} template(s)`,
          count: deleted.count,
        })

      case 'export':
        const emailTemplates = await prisma.emailTemplate.findMany({
          where: {
            id: { in: ids },
          },
          orderBy: {
            type: 'asc',
          },
        })

        const headers = [
          'ID',
          'Name',
          'Type',
          'Subject',
          'Is Default',
          'Is Active',
          'Created At',
        ]

        const rows = emailTemplates.map((template) => [
          template.id,
          template.name,
          template.type,
          template.subject,
          template.isDefault ? 'Yes' : 'No',
          template.isActive ? 'Yes' : 'No',
          format(new Date(template.createdAt), 'yyyy-MM-dd'),
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="email-templates-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

