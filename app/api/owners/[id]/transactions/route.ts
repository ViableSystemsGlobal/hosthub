import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { TransactionType, Currency } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Owners can only see their own transactions
    if (user.role === 'OWNER' && user.ownerId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const transactions = await prisma.ownerTransaction.findMany({
      where: { ownerId: id },
      include: {
        Statement: true,
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(transactions)
  } catch (error: any) {
    console.error('Failed to fetch transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAdmin()
    
    const body = await request.json()
    const { type, amount, currency, referenceId, notes, date } = body

    const transaction = await prisma.ownerTransaction.create({
      data: {
        id: crypto.randomUUID(),
        ownerId: id,
        type: type as TransactionType,
        amount,
        currency: currency as Currency,
        referenceId,
        notes,
        date: date ? new Date(date) : new Date(),
      },
    })

    // Update wallet balance
    const transactions = await prisma.ownerTransaction.findMany({
      where: { ownerId: id },
    })

    const newBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0)

    await prisma.ownerWallet.upsert({
      where: { ownerId: id },
      update: { currentBalance: newBalance },
      create: {
        ownerId: id,
        currentBalance: newBalance,
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create transaction' },
      { status: 500 }
    )
  }
}

