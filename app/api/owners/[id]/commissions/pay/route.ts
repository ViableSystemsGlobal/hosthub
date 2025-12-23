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
          ownerId: id,
          currentBalance: 0,
          commissionsPayable: 0,
        },
      })
    }

    // Round input amount to 2 decimal places
    // Note: Wallet balances are stored in the owner's preferred currency (GHS)
    // We do NOT convert to base currency - the payment amount is in the same currency as the wallet
    const roundedAmount = Math.round(parseFloat(amount) * 100) / 100
    
    // Round commissions payable for comparison
    const roundedCommissionsPayable = Math.round(wallet.commissionsPayable * 100) / 100
    
    if (roundedCommissionsPayable < roundedAmount) {
      return NextResponse.json(
        { error: `Amount exceeds commissions payable balance. Available: ${roundedCommissionsPayable.toFixed(2)}, Requested: ${roundedAmount.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update wallet - reduce commissions payable (rounded)
      const updatedWallet = await tx.ownerWallet.update({
        where: { id: wallet.id },
        data: {
          commissionsPayable: {
            decrement: roundedAmount,
          },
        },
      })

      // Create transaction record (rounded amount)
      // Note: referenceId is for Statement references only, so we set it to null for commission payments
      const transaction = await tx.ownerTransaction.create({
        data: {
          id: crypto.randomUUID(),
          ownerId: id,
          type: TransactionType.COMMISSION_PAYMENT,
          amount: -roundedAmount, // Negative because it's a payment from owner
          currency: (currency || Currency.GHS) as Currency,
          referenceId: null, // referenceId only references Statement, not commission payments
          notes: reference 
            ? `${notes || `Commission payment of ${roundedAmount.toFixed(2)} ${currency || Currency.GHS}`} - Ref: ${reference}`
            : (notes || `Commission payment of ${roundedAmount.toFixed(2)} ${currency || Currency.GHS}`),
          date: new Date(),
        },
      })

      return { wallet: updatedWallet, transaction }
    })

    const updatedWallet = result.wallet

    return NextResponse.json({
      success: true,
      wallet: updatedWallet,
      message: 'Commission payment recorded successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to record commission payment' },
      { status: 500 }
    )
  }
}

