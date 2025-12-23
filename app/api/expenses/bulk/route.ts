import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { ExpenseCategory } from '@prisma/client'
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
        { error: 'No expense IDs provided' },
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
      case 'updateCategory':
        if (!data?.category) {
          return NextResponse.json(
            { error: 'Category is required' },
            { status: 400 }
          )
        }

        const updated = await prisma.expense.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            category: data.category as ExpenseCategory,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} expense(s)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.expense.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} expense(s)`,
          count: deleted.count,
        })

      case 'export':
        const expenses = await prisma.expense.findMany({
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
            date: 'desc',
          },
        })

        // Generate CSV
        const headers = [
          'ID',
          'Property',
          'Owner',
          'Category',
          'Description',
          'Amount',
          'Currency',
          'Date',
        ]

        const rows = expenses.map((expense) => [
          expense.id,
          expense.Property.name,
          expense.Owner.name,
          expense.category,
          expense.description,
          expense.amount.toString(),
          expense.currency,
          format(new Date(expense.date), 'yyyy-MM-dd'),
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="expenses-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
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

