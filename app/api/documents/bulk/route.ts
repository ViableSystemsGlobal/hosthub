import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { DocumentType } from '@prisma/client'
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
        { error: 'No document IDs provided' },
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

        const updated = await prisma.document.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            type: data.type as DocumentType,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} document(s)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.document.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} document(s)`,
          count: deleted.count,
        })

      case 'export':
        const documents = await prisma.document.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            Property: {
              select: { name: true },
            },
            Owner: {
              select: { name: true },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        const headers = [
          'ID',
          'Title',
          'Type',
          'File Name',
          'File Size',
          'Property',
          'Owner',
          'Created At',
        ]

        const rows = documents.map((doc) => [
          doc.id,
          doc.title,
          doc.type,
          doc.fileName,
          doc.fileSize?.toString() || '0',
          doc.Property?.name || '',
          doc.Owner?.name || '',
          format(new Date(doc.createdAt), 'yyyy-MM-dd'),
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="documents-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

