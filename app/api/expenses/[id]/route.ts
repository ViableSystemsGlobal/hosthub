import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser, canEditDelete } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { ExpenseCategory, Currency } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        Property: true,
        Owner: true,
        Task: true,
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json(expense)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch expense' },
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
    
    // Only admins and general managers can edit expenses
    if (!canEditDelete(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { id } = await params
    
    const body = await request.json()
    const {
      category,
      description,
      amount,
      currency,
      date,
      paidBy,
      linkedTaskId,
    } = body

    const fxRate = 1.0
    const amountInBase = await convertCurrency(amount, currency as Currency)

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        category: category as ExpenseCategory,
        description,
        amount,
        currency: currency as Currency,
        fxRateToBase: fxRate,
        amountInBase,
        date: date ? new Date(date) : undefined,
        paidBy,
        // Handle empty string as null for foreign key
        linkedTaskId: linkedTaskId || null,
      },
      include: {
        Property: true,
        Owner: true,
      },
    })

    return NextResponse.json(expense)
  } catch (error: any) {
    console.error('Update expense error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update expense' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Only admins and general managers can delete expenses
    if (!canEditDelete(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { id } = await params
    
    await prisma.expense.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete expense' },
      { status: 500 }
    )
  }
}

