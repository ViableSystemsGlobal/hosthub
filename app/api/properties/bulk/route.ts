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
        { error: 'No property IDs provided' },
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

        const updated = await prisma.property.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            status: data.status,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} property(ies)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.property.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} property(ies)`,
          count: deleted.count,
        })

      case 'export':
        const properties = await prisma.property.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            Owner: {
              select: { name: true },
            },
          },
          orderBy: {
            name: 'asc',
          },
        })

        const headers = [
          'ID',
          'Name',
          'Nickname',
          'Owner',
          'City',
          'Currency',
          'Commission Rate',
          'Status',
        ]

        const rows = properties.map((property) => [
          property.id,
          property.name,
          property.nickname || '',
          property.Owner.name,
          property.city || '',
          property.currency,
          (property.defaultCommissionRate * 100).toFixed(2) + '%',
          property.status,
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="properties-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

