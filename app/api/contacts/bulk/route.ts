import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { ContactType } from '@prisma/client'
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
        { error: 'No contact IDs provided' },
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
      case 'updateType':
        if (!data?.type) {
          return NextResponse.json(
            { error: 'Type is required' },
            { status: 400 }
          )
        }

        const updated = await prisma.contact.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            type: data.type as ContactType,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} contact(s)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.contact.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} contact(s)`,
          count: deleted.count,
        })

      case 'export':
        const contacts = await prisma.contact.findMany({
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
          'Company',
          'Email',
          'Phone',
          'Type',
          'Owner',
        ]

        const rows = contacts.map((contact) => [
          contact.id,
          contact.name,
          contact.company || '',
          contact.email || '',
          contact.phone || '',
          contact.type,
          contact.Owner?.name || '',
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="contacts-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

