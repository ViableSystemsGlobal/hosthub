import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Type assertion for MANAGER role (may not be in generated types yet)
    if ((user.role as string) !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    // Get assigned properties
    // Query properties where managerId matches user.id
    const assignedProperties = await prisma.$queryRaw<Array<{
      id: string
      name: string
      nickname: string | null
      city: string | null
      country: string | null
      status: string
      ownerId: string
    }>>`
      SELECT id, name, nickname, city, country, status, "ownerId"
      FROM "Property"
      WHERE "managerId" = ${user.id}
    `

    // Get owner details for each property
    const propertiesWithOwners = await Promise.all(
      assignedProperties.map(async (p) => {
        const owner = await prisma.owner.findUnique({
          where: { id: p.ownerId },
          select: { name: true },
        })
        return {
          ...p,
          owner: owner || { name: null },
        }
      })
    )

    const propertyIds = assignedProperties.map(p => p.id)

    // Get bookings for assigned properties this month
    const monthBookings = propertyIds.length > 0 ? await prisma.booking.findMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
        checkInDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        Property: true,
        Owner: true,
      },
    }) : []

    // Calculate metrics
    let monthRevenue = 0
    for (const booking of monthBookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const grossInGHS = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        'GHS'
      )
      monthRevenue += grossInGHS
    }

    // Get expenses for assigned properties this month
    const monthExpenses = propertyIds.length > 0 ? await prisma.expense.findMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    }) : []

    let monthExpensesTotal = 0
    monthExpenses.forEach((expense) => {
      const amountInGHS = convertCurrency(
        expense.amount,
        expense.currency,
        'GHS'
      )
      monthExpensesTotal += amountInGHS
    })

    // Get tasks for assigned properties
    const pendingTasks = propertyIds.length > 0 ? await prisma.task.count({
      where: {
        propertyId: {
          in: propertyIds,
        },
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
    }) : 0

    // Recent bookings
    const recentBookings = propertyIds.length > 0 ? await prisma.booking.findMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
      },
      take: 10,
      orderBy: { checkInDate: 'desc' },
      include: {
        Property: true,
        Owner: true,
      },
    }) : []

    return NextResponse.json({
      assignedProperties: assignedProperties.length,
      monthRevenue,
      monthExpenses: monthExpensesTotal,
      monthNet: monthRevenue - monthExpensesTotal,
      pendingTasks,
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate.toISOString(),
        totalPayout: booking.totalPayout,
        currency: booking.currency,
        guestName: booking.guestName,
        Property: { name: booking.Property.name },
        Owner: { name: booking.Owner.name },
      })),
      properties: propertiesWithOwners.map(p => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname || undefined,
        owner: p.owner?.name || 'Unknown',
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

