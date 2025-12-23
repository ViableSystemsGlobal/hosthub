import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { InventoryStatus, InventoryType, TaskType, TaskStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireOwner(request)
    
    if (!user.ownerId) {
      return NextResponse.json(
        { error: 'No owner linked' },
        { status: 403 }
      )
    }

    const owner = await prisma.owner.findUnique({
      where: { id: user.ownerId },
      include: { Property: true, OwnerWallet: true },
    })

    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const prevMonthStart = startOfMonth(subMonths(now, 1))
    const prevMonthEnd = endOfMonth(subMonths(now, 1))
    const currency = owner.preferredCurrency

    // This month revenue
    const monthBookings = await prisma.booking.findMany({
      where: {
        ownerId: user.ownerId,
        checkInDate: {
          gte: monthStart,
          lte: monthEnd,
        },
        status: 'COMPLETED',
      },
    })

    // Previous month revenue
    const prevMonthBookings = await prisma.booking.findMany({
      where: {
        ownerId: user.ownerId,
        checkInDate: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
        status: 'COMPLETED',
      },
    })

    // Revenue = gross revenue (baseAmount + cleaningFee)
    let monthRevenue = 0
    monthBookings.forEach((booking) => {
      const grossBookingAmount = (booking.baseAmount || 0) + (booking.cleaningFee || 0)
      const converted = convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      monthRevenue += isNaN(converted) ? 0 : converted
    })

    let prevMonthRevenue = 0
    prevMonthBookings.forEach((booking) => {
      const grossBookingAmount = (booking.baseAmount || 0) + (booking.cleaningFee || 0)
      const converted = convertCurrency(
        grossBookingAmount,
        booking.currency,
        currency
      )
      prevMonthRevenue += isNaN(converted) ? 0 : converted
    })

    // This month expenses
    const monthExpenses = await prisma.expense.findMany({
      where: {
        ownerId: user.ownerId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    })

    // Previous month expenses
    const prevMonthExpenses = await prisma.expense.findMany({
      where: {
        ownerId: user.ownerId,
        date: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
    })

    let monthExpensesTotal = 0
    monthExpenses.forEach((expense) => {
      const converted = convertCurrency(
        expense.amount || 0,
        expense.currency,
        currency
      )
      monthExpensesTotal += isNaN(converted) ? 0 : converted
    })

    let prevMonthExpensesTotal = 0
    prevMonthExpenses.forEach((expense) => {
      const converted = convertCurrency(
        expense.amount || 0,
        expense.currency,
        currency
      )
      prevMonthExpensesTotal += isNaN(converted) ? 0 : converted
    })

    const monthNet = monthRevenue - monthExpensesTotal
    const prevMonthNet = prevMonthRevenue - prevMonthExpensesTotal
    const currentBalance = owner.OwnerWallet?.currentBalance || 0

    // Recent bookings (last 5)
    const recentBookings = await prisma.booking.findMany({
      where: {
        ownerId: user.ownerId,
      },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
      orderBy: { checkInDate: 'desc' },
      take: 5,
    })

    // Upcoming bookings (next 5)
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        ownerId: user.ownerId,
        checkInDate: {
          gte: now,
        },
        status: 'UPCOMING',
      },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
      orderBy: { checkInDate: 'asc' },
      take: 5,
    })

    // Daily revenue data for chart (last 30 days)
    const dailyRevenueData: number[] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))
      
      const dayBookings = await prisma.booking.findMany({
        where: {
          ownerId: user.ownerId,
          checkInDate: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: 'COMPLETED',
        },
      })

      let dayRevenue = 0
      dayBookings.forEach((booking) => {
        const grossBookingAmount = (booking.baseAmount || 0) + (booking.cleaningFee || 0)
        const converted = convertCurrency(
          grossBookingAmount,
          booking.currency,
          currency
        )
        dayRevenue += isNaN(converted) ? 0 : converted
      })
      dailyRevenueData.push(dayRevenue)
    }

    // Properties with revenue summary
    const propertiesWithRevenue = owner.Property && owner.Property.length > 0
      ? await Promise.all(
          owner.Property.map(async (property) => {
            const propertyBookings = await prisma.booking.findMany({
              where: {
                propertyId: property.id,
                checkInDate: {
                  gte: monthStart,
                  lte: monthEnd,
                },
                status: 'COMPLETED',
              },
            })

        // Revenue = gross revenue (baseAmount + cleaningFee)
        let revenue = 0
        propertyBookings.forEach((booking) => {
          const grossBookingAmount = (booking.baseAmount || 0) + (booking.cleaningFee || 0)
          const converted = convertCurrency(
            grossBookingAmount,
            booking.currency,
            currency
          )
          revenue += isNaN(converted) ? 0 : converted
        })

            return {
              id: property.id,
              name: property.name,
              revenue,
            }
          })
        )
      : []

    const commissionsPayable = owner.OwnerWallet?.commissionsPayable || 0

    // Get property IDs for owner
    const propertyIds = owner.Property.map(p => p.id)

    // Cleaning tasks metrics
    const pendingCleaningTasks = propertyIds.length > 0 ? await prisma.task.count({
      where: {
        propertyId: { in: propertyIds },
        type: TaskType.CLEANING,
        status: TaskStatus.PENDING,
      },
    }) : 0

    const readyForGuestTasks = propertyIds.length > 0 ? await prisma.task.count({
      where: {
        propertyId: { in: propertyIds },
        type: TaskType.CLEANING,
        isReadyForGuest: true,
      },
    }) : 0

    // Check-ins metrics
    const recentCheckIns = propertyIds.length > 0 ? await prisma.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkedInAt: { not: null },
      },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        CheckedInBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { checkedInAt: 'desc' },
      take: 5,
    }) : []

    // Electricity alerts
    const lowElectricityBalances = propertyIds.length > 0 ? await prisma.electricityAlert.count({
      where: {
        propertyId: { in: propertyIds },
        resolvedAt: null,
      },
    }) : 0

    // Inventory low stock - need to fetch and filter since Prisma doesn't support comparison in count
    const lowStockItems = propertyIds.length > 0 ? (await prisma.inventoryItem.findMany({
      where: {
        propertyId: { in: propertyIds },
        type: InventoryType.CONSUMABLE,
        status: InventoryStatus.PRESENT,
        quantity: { not: null },
        minimumQuantity: { not: null },
      },
      select: {
        quantity: true,
        minimumQuantity: true,
      },
    })).filter(item => item.quantity !== null && item.minimumQuantity !== null && item.quantity < item.minimumQuantity).length : 0

    // Calculate trends
    const revenueChange = prevMonthRevenue > 0 
      ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 
      : (monthRevenue > 0 ? 100 : 0)
    
    const expensesChange = prevMonthExpensesTotal > 0
      ? ((monthExpensesTotal - prevMonthExpensesTotal) / prevMonthExpensesTotal) * 100
      : (monthExpensesTotal > 0 ? 100 : 0)
    
    const netChange = prevMonthNet !== 0
      ? ((monthNet - prevMonthNet) / Math.abs(prevMonthNet)) * 100
      : (monthNet > 0 ? 100 : monthNet < 0 ? -100 : 0)

    // Ensure all values are valid numbers
    return NextResponse.json({
      monthRevenue: isNaN(monthRevenue) ? 0 : monthRevenue,
      monthExpenses: isNaN(monthExpensesTotal) ? 0 : monthExpensesTotal,
      monthNet: isNaN(monthNet) ? 0 : monthNet,
      currentBalance: isNaN(currentBalance) ? 0 : currentBalance,
      commissionsPayable: isNaN(commissionsPayable) ? 0 : commissionsPayable,
      properties: propertiesWithRevenue || [],
      recentBookings: recentBookings.map(b => ({
        id: b.id,
        propertyName: b.Property.nickname || b.Property.name,
        guestName: b.guestName,
        checkInDate: b.checkInDate.toISOString(),
        checkOutDate: b.checkOutDate.toISOString(),
        totalPayout: b.totalPayout || 0,
        currency: b.currency,
        status: b.status,
      })),
      upcomingBookings: upcomingBookings.map(b => ({
        id: b.id,
        propertyName: b.Property.nickname || b.Property.name,
        guestName: b.guestName,
        checkInDate: b.checkInDate.toISOString(),
        checkOutDate: b.checkOutDate.toISOString(),
        nights: b.nights,
        totalPayout: b.totalPayout || 0,
        currency: b.currency,
      })),
      trends: {
        revenue: {
          current: isNaN(monthRevenue) ? 0 : monthRevenue,
          previous: isNaN(prevMonthRevenue) ? 0 : prevMonthRevenue,
          change: isNaN(revenueChange) ? 0 : revenueChange,
        },
        expenses: {
          current: isNaN(monthExpensesTotal) ? 0 : monthExpensesTotal,
          previous: isNaN(prevMonthExpensesTotal) ? 0 : prevMonthExpensesTotal,
          change: isNaN(expensesChange) ? 0 : expensesChange,
        },
        net: {
          current: isNaN(monthNet) ? 0 : monthNet,
          previous: isNaN(prevMonthNet) ? 0 : prevMonthNet,
          change: isNaN(netChange) ? 0 : netChange,
        },
      },
      dailyRevenueData: dailyRevenueData.map(d => isNaN(d) ? 0 : d),
      pendingCleaningTasks,
      readyForGuestTasks,
      recentCheckIns: recentCheckIns.map(c => ({
        id: c.id,
        propertyName: c.Property.nickname || c.Property.name,
        guestName: c.guestName,
        checkedInAt: c.checkedInAt?.toISOString(),
        checkedInBy: c.CheckedInBy?.name,
      })),
      lowElectricityBalances,
      lowStockItems,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

