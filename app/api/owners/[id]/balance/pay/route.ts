import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { Currency, TransactionType } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    
    const body = await request.json()
    const { amount, currency, reference, notes } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Get owner wallet
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
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }

    // Round input amount to 2 decimal places
    const roundedAmount = Math.round(parseFloat(amount) * 100) / 100
    
    // Check that balance is negative (owner owes us money)
    if (wallet.currentBalance >= 0) {
      return NextResponse.json(
        { error: 'Owner does not have an outstanding balance' },
        { status: 400 }
      )
    }
    
    // Check that amount doesn't exceed what's owed
    const amountOwed = Math.abs(wallet.currentBalance)
    const roundedAmountOwed = Math.round(amountOwed * 100) / 100
    
    if (roundedAmount > roundedAmountOwed) {
      return NextResponse.json(
        { error: `Amount exceeds outstanding balance. Maximum: ${roundedAmountOwed.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record (positive amount to increase balance)
      const transaction = await tx.ownerTransaction.create({
        data: {
          id: crypto.randomUUID(),
          ownerId: id,
          type: TransactionType.MANUAL_ADJUSTMENT,
          amount: roundedAmount, // Positive to increase balance (reduce debt)
          currency: (currency || Currency.GHS) as Currency,
          referenceId: null,
          notes: reference 
            ? `Balance payment received - Ref: ${reference}${notes ? ` - ${notes}` : ''}`
            : (notes || `Balance payment received - ${roundedAmount.toFixed(2)} ${currency || Currency.GHS}`),
          date: new Date(),
        },
      })

      // Update wallet balance
      const updatedWallet = await tx.ownerWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: {
            increment: roundedAmount,
          },
          updatedAt: new Date(),
        },
      })

      return { wallet: updatedWallet, transaction }
    })

    return NextResponse.json({
      success: true,
      wallet: result.wallet,
      transaction: result.transaction,
      message: 'Balance payment recorded successfully',
    })
  } catch (error: any) {
    console.error('Failed to record balance payment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record balance payment' },
      { status: 500 }
    )
  }
}

