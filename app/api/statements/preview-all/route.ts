import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'

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

      // Calculate totals
      let revenue = 0
      let companyRevenue = 0
      let ownerRevenue = 0

      // Separate bookings by payment flow
      const companyBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'COMPANY')
      const ownerBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'OWNER')

      for (const booking of bookings) {
        const baseAmount = booking.baseAmount || 0
        const cleaningFee = booking.cleaningFee || 0
        const grossBookingAmount = baseAmount + cleaningFee
        
        const amountInDisplay = await convertCurrency(
          grossBookingAmount,
          booking.currency,
          currency
        )
        revenue += amountInDisplay
      }

      // Calculate company and owner revenue separately
      for (const booking of companyBookings) {
        const grossBookingAmount = booking.baseAmount + booking.cleaningFee
        const amountInDisplay = await convertCurrency(
          grossBookingAmount,
          booking.currency,
          currency
        )
        companyRevenue += amountInDisplay
      }

      for (const booking of ownerBookings) {
        const grossBookingAmount = booking.baseAmount + booking.cleaningFee
        const amountInDisplay = await convertCurrency(
          grossBookingAmount,
          booking.currency,
          currency
        )
        ownerRevenue += amountInDisplay
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

      // Calculate commission
      let commissionAmount = 0
      let companyCommission = 0
      let ownerCommission = 0

      for (const booking of bookings) {
        const property = booking.Property
        const commissionRate = property.defaultCommissionRate || 0.15
        const grossBookingAmount = booking.baseAmount + booking.cleaningFee
        const grossBookingInDisplay = await convertCurrency(
          grossBookingAmount,
          booking.currency,
          currency
        )
        const commission = grossBookingInDisplay * commissionRate
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

      // Add booking lines
      for (const booking of bookings) {
        const grossBookingAmount = booking.baseAmount + booking.cleaningFee
        const amountInDisplay = await convertCurrency(
          grossBookingAmount,
          booking.currency,
          currency
        )
        
        statementLines.push({
          type: 'BOOKING',
          description: `Booking: ${booking.guestName || 'Guest'} - ${booking.Property?.nickname || booking.Property?.name || 'Property'}`,
          amountInDisplayCurrency: amountInDisplay,
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
