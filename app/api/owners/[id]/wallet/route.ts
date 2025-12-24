import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Owners can only see their own wallet
    if (user.role === 'OWNER' && user.ownerId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get or create wallet
    let wallet = await prisma.ownerWallet.findUnique({
      where: { ownerId: id },
    })

    if (!wallet) {
      wallet = await prisma.ownerWallet.create({
        data: {
          id: crypto.randomUUID(),
          ownerId: id,
          currentBalance: 0,
          commissionsPayable: 0,
          updatedAt: new Date(),
        },
      })
    }

    // Calculate actual balance from transactions
    const transactions = await prisma.ownerTransaction.findMany({
      where: { ownerId: id },
      orderBy: { date: 'desc' },
    })

    const calculatedBalance = transactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    )

    // Update wallet balance if different
    if (wallet.currentBalance !== calculatedBalance) {
      wallet = await prisma.ownerWallet.update({
        where: { id: wallet.id },
        data: { currentBalance: calculatedBalance },
      })
    }

    return NextResponse.json({
      ...wallet,
      transactions,
      calculatedBalance,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch wallet' },
      { status: 500 }
    )
  }
}

