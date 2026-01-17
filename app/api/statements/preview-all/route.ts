import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertCurrency, getFxRate } from '@/lib/currency'
import { Currency } from '@prisma/client'

/**
 * Convert booking amount from USD base to GHS using historical rates
 * Matches the Revenue report calculation exactly
 */
async function convertToGHSHistorical(booking: {
  currency: Currency
  fxRateToBase: number
  totalPayoutInBase: number
}): Promise<number> {
  const usdAmount = booking.totalPayoutInBase || 0
  
  if (booking.currency === 'GHS') {
    // If booking was in GHS, fxRateToBase is GHS→USD rate
    // To get USD→GHS, we invert it: 1 / fxRateToBase
    const usdToGhsRate = booking.fxRateToBase > 0 ? 1 / booking.fxRateToBase : 0
    return usdAmount * usdToGhsRate
  } else if (booking.currency === 'USD') {
    // If booking was in USD, use current rate as fallback
    const currentUsdToGhs = await getFxRate('USD', 'GHS')
    return usdAmount * currentUsdToGhs
  }
  
  return usdAmount
}

/**
 * Generate preview statements for all owners for a given period
 * Used in the All Reports PDF export
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { periodStart, periodEnd, displayCurrency = 'GHS' } = body

    const startDate = new Date(periodStart)
    const endDate = new Date(periodEnd)
    const currency = displayCurrency as Currency

    // Get all owners with properties
    const owners = await prisma.owner.findMany({
      include: { 
        Property: true,
        OwnerWallet: true,
      },
    })

    const statements: any[] = []

    for (const owner of owners) {
      // Get COMPLETED bookings in period for this owner (to match Revenue report)
      const bookings = await prisma.booking.findMany({
        where: {
          ownerId: owner.id,
          checkInDate: {
            gte: startDate,
            lte: endDate,
          },
          status: 'COMPLETED', // Only completed bookings for consistency with Revenue report
        },
        include: { Property: true },
      })

      // Get all expenses in period for this owner
      const expenses = await prisma.expense.findMany({
        where: {
          ownerId: owner.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: { Property: true },
      })

      // Skip owners with no activity
      if (bookings.length === 0 && expenses.length === 0) {
        continue
      }

      // Calculate totals using historical rates (same as Revenue report)
      let revenue = 0
      let companyRevenue = 0
      let ownerRevenue = 0

      // Separate bookings by payment flow
      const companyBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'COMPANY')
      const ownerBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'OWNER')

      for (const booking of bookings) {
        // Use totalPayoutInBase and historical rates to match Revenue report exactly
        const amountInGHS = await convertToGHSHistorical({
          currency: booking.currency as Currency,
          fxRateToBase: booking.fxRateToBase || 1.0,
          totalPayoutInBase: booking.totalPayoutInBase || 0,
        })
        revenue += amountInGHS
      }

      // Calculate company and owner revenue separately
      for (const booking of companyBookings) {
        const amountInGHS = await convertToGHSHistorical({
          currency: booking.currency as Currency,
          fxRateToBase: booking.fxRateToBase || 1.0,
          totalPayoutInBase: booking.totalPayoutInBase || 0,
        })
        companyRevenue += amountInGHS
      }

      for (const booking of ownerBookings) {
        const amountInGHS = await convertToGHSHistorical({
          currency: booking.currency as Currency,
          fxRateToBase: booking.fxRateToBase || 1.0,
          totalPayoutInBase: booking.totalPayoutInBase || 0,
        })
        ownerRevenue += amountInGHS
      }

      // Calculate expenses
      let companyPaidExpenses = 0
      let ownerPaidExpenses = 0
      
      for (const expense of expenses) {
        const amountInDisplay = await convertCurrency(
          expense.amount,
          expense.currency,
          currency
        )
        
        if (expense.paidBy === 'owner') {
          ownerPaidExpenses += amountInDisplay
        } else if (expense.paidBy === 'company') {
          companyPaidExpenses += amountInDisplay
        }
      }
      
      const totalExpenses = companyPaidExpenses + ownerPaidExpenses

      // Calculate commission using historical rates (same as Revenue report)
      let commissionAmount = 0
      let companyCommission = 0
      let ownerCommission = 0

      for (const booking of bookings) {
        const property = booking.Property
        const commissionRate = property.defaultCommissionRate || 0.15
        const bookingInGHS = await convertToGHSHistorical({
          currency: booking.currency as Currency,
          fxRateToBase: booking.fxRateToBase || 1.0,
          totalPayoutInBase: booking.totalPayoutInBase || 0,
        })
        const commission = bookingInGHS * commissionRate
        commissionAmount += commission

        if ((booking as any).paymentReceivedBy === 'COMPANY') {
          companyCommission += commission
        } else {
          ownerCommission += commission
        }
      }

      // Calculate net to owner
      const grossAfterCommission = revenue - commissionAmount
      const netFromCompany = companyRevenue - companyCommission - companyPaidExpenses
      const netToOwner = netFromCompany - ownerCommission + ownerPaidExpenses

      // Get opening balance
      const wallet = owner.OwnerWallet
      const openingBalance = wallet?.currentBalance || 0
      const closingBalance = openingBalance + netToOwner

      // Build statement lines
      const statementLines: any[] = []

      // Add booking lines using historical rates (same as Revenue report)
      for (const booking of bookings) {
        const amountInGHS = await convertToGHSHistorical({
          currency: booking.currency as Currency,
          fxRateToBase: booking.fxRateToBase || 1.0,
          totalPayoutInBase: booking.totalPayoutInBase || 0,
        })
        
        statementLines.push({
          type: 'BOOKING',
          description: `Booking: ${booking.guestName || 'Guest'} - ${booking.Property?.nickname || booking.Property?.name || 'Property'}`,
          amountInDisplayCurrency: amountInGHS,
          bookingId: booking.id,
        })
      }

      // Add expense lines
      for (const expense of expenses) {
        const amountInDisplay = await convertCurrency(
          expense.amount,
          expense.currency,
          currency
        )
        
        statementLines.push({
          type: 'EXPENSE',
          description: `Expense: ${expense.description} (${expense.Property?.nickname || expense.Property?.name || 'Property'})`,
          amountInDisplayCurrency: -amountInDisplay,
          expenseId: expense.id,
        })
      }

      // Add commission line
      if (commissionAmount > 0) {
        statementLines.push({
          type: 'COMMISSION',
          description: 'Management Commission',
          amountInDisplayCurrency: -commissionAmount,
        })
      }

      statements.push({
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
        },
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        displayCurrency: currency,
        grossRevenue: revenue,
        companyRevenue,
        ownerRevenue,
        commissionAmount,
        companyCommission,
        ownerCommission,
        totalExpenses,
        companyPaidExpenses,
        ownerPaidExpenses,
        netToOwner,
        openingBalance,
        closingBalance,
        statementLines,
        bookingsCount: bookings.length,
        expensesCount: expenses.length,
      })
    }

    return NextResponse.json(statements)
  } catch (error: any) {
    console.error('Failed to generate preview statements:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate preview statements' },
      { status: 500 }
    )
  }
}
