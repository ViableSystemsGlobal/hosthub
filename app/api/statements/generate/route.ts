import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { Currency, TransactionType } from '@prisma/client'
// Define StatementStatus locally to avoid build issues if Prisma client is stale
enum StatementStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED'
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    
    const body = await request.json()
    const { ownerId, periodStart, periodEnd, displayCurrency } = body

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      include: { 
        Property: true,
        OwnerWallet: true,
      },
    })

    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const startDate = new Date(periodStart)
    const endDate = new Date(periodEnd)
    const currency = (displayCurrency || owner.preferredCurrency) as Currency

    // Get all bookings in period (completed)
    const bookings = await prisma.booking.findMany({
      where: {
        ownerId,
        checkInDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
      include: { Property: true },
    })

    // Get all expenses in period
    const expenses = await prisma.expense.findMany({
      where: {
        ownerId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { Property: true },
    })

    // Calculate totals
    let grossRevenue = 0

    // Separate bookings by payment flow
    const companyBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'COMPANY')
    const ownerBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'OWNER')

    // Gross revenue = baseAmount + cleaningFee (total collected from guest)
    // This represents total revenue regardless of who received it
    for (const booking of bookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const amountInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      grossRevenue += amountInDisplay
    }

    // Separate expenses by who paid
    let companyPaidExpenses = 0
    let ownerPaidExpenses = 0
    
    for (const expense of expenses) {
      const amountInDisplay = await convertCurrency(
        expense.amount,
        expense.currency,
        currency
      )
      
      // If company paid, subtract from what we owe owner
      // If owner paid, add to what we owe owner (reimbursement)
      if (expense.paidBy === 'owner') {
        ownerPaidExpenses += amountInDisplay
      } else if (expense.paidBy === 'company') {
        companyPaidExpenses += amountInDisplay
      }
      // Vendor-paid expenses don't affect owner balance
    }
    
    const totalExpenses = companyPaidExpenses + ownerPaidExpenses

    // Calculate commission (rate * gross revenue per property)
    // Commission is calculated on gross revenue (baseAmount + cleaningFee)
    let commissionAmount = 0
    const propertyCommissions: Record<string, number> = {}

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

      if (!propertyCommissions[property.id]) {
        propertyCommissions[property.id] = 0
      }
      propertyCommissions[property.id] += commission
      commissionAmount += commission
    }

    // Calculate net to owner based on payment flow:
    // COMPANY: We received payment, we owe owner (gross - expenses - commission) = positive
    // OWNER: Owner received payment, they owe us commission only = negative (they owe us)
    // 
    // Net calculation:
    // - Company bookings: We owe owner = grossRevenue - expenses - commission (positive)
    // - Owner bookings: Owner owes us = commission only (negative)
    // - Total net = (what we owe) - (what they owe us)
    
    let companyRevenue = 0
    for (const booking of companyBookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const amountInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      companyRevenue += amountInDisplay
    }

    let ownerRevenue = 0
    for (const booking of ownerBookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const amountInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      ownerRevenue += amountInDisplay
    }

    // Calculate commission for each payment type
    let companyCommission = 0
    for (const booking of companyBookings) {
      const property = booking.Property
      const commissionRate = property.defaultCommissionRate || 0.15
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const grossBookingInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      companyCommission += grossBookingInDisplay * commissionRate
    }

    let ownerCommission = 0
    for (const booking of ownerBookings) {
      const property = booking.Property
      const commissionRate = property.defaultCommissionRate || 0.15
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const grossBookingInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      ownerCommission += grossBookingInDisplay * commissionRate
    }

    // Net to owner calculation:
    // - For COMPANY bookings: we owe them = companyRevenue - companyPaidExpenses - companyCommission (positive)
    // - For OWNER bookings: they owe us = ownerCommission (negative, so subtract it)
    // - Owner-paid expenses: we owe them back (reimbursement) = ownerPaidExpenses (positive, so add it)
    // - Total net = what we owe minus what they owe us
    const netFromCompany = companyRevenue - companyPaidExpenses - companyCommission
    const netToOwner = netFromCompany - ownerCommission + ownerPaidExpenses

    // Opening balance is always 0 for each period (fresh start)
    const openingBalance = 0
    const closingBalance = netToOwner

    // Get current commissions payable from wallet
    const commissionsPayable = owner.OwnerWallet?.commissionsPayable || 0

    // Create draft statement
    const statement = await prisma.statement.create({
      data: {
        id: crypto.randomUUID(),
        ownerId,
        periodStart: startDate,
        periodEnd: endDate,
        status: StatementStatus.DRAFT,
        displayCurrency: currency,
        grossRevenue,
        totalExpenses,
        commissionAmount,
        netToOwner,
        openingBalance,
        closingBalance,
        // Breakdown by payment flow
        companyRevenue,
        ownerRevenue,
        companyCommission,
        ownerCommission,
        updatedAt: new Date(),
      },
    })

    // Create statement lines for bookings
    for (const booking of bookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const amountInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )

      const paymentFlow = (booking as any).paymentReceivedBy === 'COMPANY' 
        ? 'Payment received by Company' 
        : 'Payment received by Owner'

      await prisma.statementLine.create({
        data: {
          id: crypto.randomUUID(),
          statementId: statement.id,
          type: 'booking',
          referenceId: booking.id,
          description: `Booking - ${booking.Property.name} (${booking.checkInDate.toISOString().split('T')[0]}) [${paymentFlow}]`,
          amount: grossBookingAmount,
          currency: booking.currency,
          amountInDisplayCurrency: amountInDisplay,
        },
      })
    }

    // Create statement lines for expenses
    for (const expense of expenses) {
      const amountInDisplay = await convertCurrency(
        expense.amount,
        expense.currency,
        currency
      )

      await prisma.statementLine.create({
        data: {
          id: crypto.randomUUID(),
          statementId: statement.id,
          type: 'expense',
          referenceId: expense.id,
          description: `${expense.category} - ${expense.Property.name}`,
          amount: expense.amount,
          currency: expense.currency,
          amountInDisplayCurrency: amountInDisplay,
        },
      })
    }

    // Add commission line
    await prisma.statementLine.create({
      data: {
        id: crypto.randomUUID(),
        statementId: statement.id,
        type: 'commission',
        description: 'Management Commission',
        amount: commissionAmount,
        currency,
        amountInDisplayCurrency: commissionAmount,
      },
    })

    // Fetch statement with lines
    const statementWithLines = await prisma.statement.findUnique({
      where: { id: statement.id },
      include: {
        StatementLine: true,
        Owner: true,
      },
    })

    return NextResponse.json(statementWithLines, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate statement' },
      { status: 500 }
    )
  }
}

