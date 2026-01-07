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

    // Get all bookings in period (matching dashboard logic - all statuses)
    const bookings = await prisma.booking.findMany({
      where: {
        ownerId,
        checkInDate: {
          gte: startDate,
          lte: endDate,
        },
        // No status filter - include all bookings like dashboard does
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
    // Revenue = baseAmount + cleaningFee (total collected from guest)
    // This represents total revenue regardless of who received it
    let revenue = 0

    // Separate bookings by payment flow
    const companyBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'COMPANY')
    const ownerBookings = bookings.filter(b => (b as any).paymentReceivedBy === 'OWNER')

    for (const booking of bookings) {
      // Revenue = baseAmount + cleaningFee (total collected from guest)
      // Ensure we have valid amounts
      const baseAmount = booking.baseAmount || 0
      const cleaningFee = booking.cleaningFee || 0
      const grossBookingAmount = baseAmount + cleaningFee
      
      if (grossBookingAmount <= 0) {
        console.warn(`Booking ${booking.id} has zero or negative revenue: baseAmount=${baseAmount}, cleaningFee=${cleaningFee}`)
      }
      
      const amountInDisplay = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      revenue += amountInDisplay
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

    // Calculate revenue by payment type (gross revenue = baseAmount + cleaningFee)
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
    // Commission is calculated on gross revenue (baseAmount + cleaningFee) BEFORE expenses
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

    // Total commission = sum of all commissions (on all revenue before expenses)
    const commissionAmount = companyCommission + ownerCommission
    
    // Validate: revenue should equal companyRevenue + ownerRevenue
    const calculatedRevenue = companyRevenue + ownerRevenue
    if (Math.abs(revenue - calculatedRevenue) > 0.01) {
      console.warn(`Revenue mismatch: total=${revenue}, sum=${calculatedRevenue}. Using calculated sum.`)
      revenue = calculatedRevenue // Use the sum to ensure accuracy
    }
    
    // Debug: Log revenue calculation
    console.log(`[Statement] Revenue calculation: total=${revenue.toFixed(2)}, company=${companyRevenue.toFixed(2)}, owner=${ownerRevenue.toFixed(2)}, bookings=${bookings.length}`)
    
    const propertyCommissions: Record<string, number> = {}
    
    // Calculate property-level commissions for display
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
    }

    // Net to owner calculation (correct flow):
    // 1. Revenue (total bookings)
    // 2. Commission (calculated on revenue)
    // 3. Gross (Revenue - Commission)
    // 4. Expenses (deducted from gross)
    // 5. Net (Gross - Expenses + owner-paid expense reimbursement)
    
    // Commission is calculated on revenue (before expenses)
    // Gross revenue after commission
    const grossAfterCommission = revenue - commissionAmount
    
    // Net calculation:
    // - For COMPANY bookings: Revenue - Commission - Company Expenses = what we owe owner
    // - For OWNER bookings: Owner received money directly, we take commission from what they received
    //   So: ownerRevenue - ownerCommission = what owner keeps after we take our commission
    //   But we're calculating what WE owe them, so: -ownerCommission (they owe us commission)
    // - Owner-paid expenses: we owe them back (reimbursement) = positive, so add
    // 
    // The key insight: When owner receives money directly, we take ALL commission from what they received.
    // So if owner received $1000 and commission is $150, we take $150 from that $1000.
    // Net to owner = (company revenue - company commission - company expenses) - (owner commission) + (owner-paid expenses)
    const netFromCompany = companyRevenue - companyCommission - companyPaidExpenses
    // Owner commission is what we're owed from owner-received payments
    // This is already calculated correctly: commission on full owner revenue
    const netToOwner = netFromCompany - ownerCommission + ownerPaidExpenses

    // Opening balance is always 0 for each period (fresh start)
    const openingBalance = 0
    const closingBalance = netToOwner

    // Get current commissions payable from wallet
    const commissionsPayable = owner.OwnerWallet?.commissionsPayable || 0

    // Create draft statement
    // Note: grossRevenue field stores total revenue (before commission)
    // The flow is: Revenue → Commission → Gross (Revenue - Commission) → Expenses → Net
    const statement = await prisma.statement.create({
      data: {
        id: crypto.randomUUID(),
        ownerId,
        periodStart: startDate,
        periodEnd: endDate,
        status: StatementStatus.DRAFT,
        displayCurrency: currency,
        grossRevenue: revenue, // Total revenue (before commission)
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

