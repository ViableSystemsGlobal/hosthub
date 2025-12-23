import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns'

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

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const property = await prisma.property.findUnique({
      where: { id },
      include: { Owner: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Owners can only see their own properties
    if (user.role === 'OWNER' && property.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Default to current month if no dates provided
    const periodStart = startDate
      ? new Date(startDate)
      : startOfMonth(new Date())
    const periodEnd = endDate ? new Date(endDate) : endOfMonth(new Date())

    // Get bookings in period
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: id,
        checkInDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    // Get expenses in period
    const expenses = await prisma.expense.findMany({
      where: {
        propertyId: id,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    // Calculate metrics
    const totalNights = bookings.reduce((sum, b) => sum + b.nights, 0)
    const periodDays = differenceInDays(periodEnd, periodStart) + 1
    const occupancy = periodDays > 0 ? (totalNights / periodDays) * 100 : 0

    // Revenue = gross revenue (baseAmount + cleaningFee)
    let revenue = 0
    bookings.forEach((booking) => {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      revenue += convertCurrency(
        grossBookingAmount,
        booking.currency,
        property.currency
      )
    })

    let expensesTotal = 0
    expenses.forEach((expense) => {
      expensesTotal += convertCurrency(
        expense.amount,
        expense.currency,
        property.currency
      )
    })

    const net = revenue - expensesTotal

    return NextResponse.json({
      occupancy: Math.min(occupancy, 100),
      revenue,
      expenses: expensesTotal,
      net,
      bookings,
      expensesList: expenses,
      periodStart,
      periodEnd,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

