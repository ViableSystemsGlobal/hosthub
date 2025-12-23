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
        { error: 'No owner IDs provided' },
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

        const updated = await prisma.owner.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            status: data.status,
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} owner(s)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.owner.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} owner(s)`,
          count: deleted.count,
        })

      case 'export':
        const owners = await prisma.owner.findMany({
          where: {
            id: { in: ids },
          },
          orderBy: {
            name: 'asc',
          },
        })

        const headers = [
          'ID',
          'Name',
          'Email',
          'Phone',
          'WhatsApp',
          'Preferred Currency',
          'Status',
        ]

        const rows = owners.map((owner) => [
          owner.id,
          owner.name,
          owner.email,
          owner.phoneNumber || '',
          owner.whatsappNumber || '',
          owner.preferredCurrency,
          owner.status,
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="owners-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

