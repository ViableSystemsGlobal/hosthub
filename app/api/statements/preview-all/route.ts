import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertCurrency, getFxRate } from '@/lib/currency'
import { Currency } from '@prisma/client'

/**
 * Convert USD amount to GHS using CURRENT exchange rate
 * This matches the Revenue report calculation exactly for consistency
 */
async function convertToGHSConsistent(usdAmount: number): Promise<number> {
  if (usdAmount === 0) return 0
  const currentUsdToGhs = await getFxRate('USD', 'GHS')
  return usdAmount * currentUsdToGhs
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

      // Calculate total revenue using current FX rate for consistency with Revenue report
      const totalRevenueUSD = bookings.reduce((sum, b) => sum + (b.totalPayoutInBase || 0), 0)
      revenue = await convertToGHSConsistent(totalRevenueUSD)

      // Calculate company and owner revenue separately
      const companyRevenueUSD = companyBookings.reduce((sum, b) => sum + (b.totalPayoutInBase || 0), 0)
      companyRevenue = await convertToGHSConsistent(companyRevenueUSD)

      const ownerRevenueUSD = ownerBookings.reduce((sum, b) => sum + (b.totalPayoutInBase || 0), 0)
      ownerRevenue = await convertToGHSConsistent(ownerRevenueUSD)

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

      // Calculate commission using current FX rate (same as Revenue report)
      // Get FX rate once for efficiency
      const usdToGhs = await getFxRate('USD', 'GHS')
      
      let commissionAmount = 0
      let companyCommission = 0
      let ownerCommission = 0

      for (const booking of bookings) {
        const property = booking.Property
        const commissionRate = property.defaultCommissionRate || 0.15
        const bookingInGHS = (booking.totalPayoutInBase || 0) * usdToGhs
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

      // Add booking lines using current FX rate (same as Revenue report)
      for (const booking of bookings) {
        const amountInGHS = (booking.totalPayoutInBase || 0) * usdToGhs
        
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
