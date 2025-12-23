import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { Currency, TransactionType } from '@prisma/client'
import { sendPayoutNotification } from '@/lib/notifications/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const ownerId = searchParams.get('ownerId')

    const where: any = {}
    
    // Owners can only see their own payouts
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'No owner linked' }, { status: 403 })
      }
      where.ownerId = user.ownerId
    } else {
      // Admins can filter by ownerId
      if (ownerId) where.ownerId = ownerId
    }

    const payouts = await prisma.payout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Fetch owner details separately since Payout doesn't have a relation
    const payoutsWithOwners = await Promise.all(
      payouts.map(async (payout) => {
        const owner = await prisma.owner.findUnique({
          where: { id: payout.ownerId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
        return {
          ...payout,
          Owner: owner,
        }
      })
    )

    return NextResponse.json(payoutsWithOwners)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payouts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    
    const body = await request.json()
    const { ownerId, amount, currency, method, reference, processedAt } = body

    if (!ownerId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Owner ID and positive amount are required' },
        { status: 400 }
      )
    }

    // Round amount to 2 decimal places
    const roundedAmount = Math.round(parseFloat(amount) * 100) / 100

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create payout record (rounded amount)
      const payout = await tx.payout.create({
        data: {
          id: crypto.randomUUID(),
          ownerId,
          amount: roundedAmount,
          currency: (currency || Currency.GHS) as Currency,
          method: method || null,
          reference: reference || null,
          processedAt: processedAt ? new Date(processedAt) : new Date(),
          updatedAt: new Date(),
        },
      })

      // Create transaction (negative amount to reduce balance, rounded)
      // Note: referenceId is for Statement references only, so we set it to null for payouts
      const transaction = await tx.ownerTransaction.create({
        data: {
          id: crypto.randomUUID(),
          ownerId,
          type: TransactionType.PAYOUT,
          amount: -roundedAmount, // Negative to reduce balance
          currency: (currency || Currency.GHS) as Currency,
          referenceId: null, // referenceId only references Statement, not Payout
          notes: `Payout ${method ? `via ${method}` : ''}${reference ? ` - Ref: ${reference}` : ''} (Payout ID: ${payout.id})`,
          date: processedAt ? new Date(processedAt) : new Date(),
        },
      })

      // Update wallet balance
      const allTransactions = await tx.ownerTransaction.findMany({
        where: { ownerId },
      })

      const newBalance = allTransactions.reduce((sum, tx) => sum + tx.amount, 0)

      await tx.ownerWallet.upsert({
        where: { ownerId },
        update: { currentBalance: newBalance },
        create: {
          id: crypto.randomUUID(),
          ownerId,
          currentBalance: newBalance,
          commissionsPayable: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      return { payout, transaction }
    })

    // Send notification (non-blocking)
    try {
      await sendPayoutNotification(result.payout.id, ownerId)
    } catch (notifError) {
      console.error('Failed to send payout notification:', notifError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json(result.payout, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create payout' },
      { status: 500 }
    )
  }
}

