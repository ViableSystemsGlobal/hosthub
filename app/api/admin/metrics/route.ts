import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { startOfMonth, endOfMonth, subMonths, eachDayOfInterval, format, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subWeeks, subQuarters, subYears } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (authError) {
    console.error('[Admin Metrics] Auth error:', authError)
    // If it's an auth error, return it directly
    const authStatus = typeof authError === 'object' && authError && 'status' in authError
      ? Number((authError as any).status) || undefined
      : undefined

    if (authStatus) {
      const authMessage = authError instanceof Error ? authError.message : 'Unauthorized'
      return NextResponse.json(
        { error: authMessage },
        { status: authStatus }
      )
    }
    throw authError
  }
  
  try {
    const now = new Date()
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'month' // week, month, quarter, year

    // Calculate date range based on period
    let periodStart: Date
    let periodEnd: Date
    let previousPeriodStart: Date
    let previousPeriodEnd: Date

    switch (period) {
      case 'week':
        periodStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
        periodEnd = endOfWeek(now, { weekStartsOn: 1 })
        previousPeriodStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        previousPeriodEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        break
      case 'quarter':
        periodStart = startOfQuarter(now)
        periodEnd = endOfQuarter(now)
        previousPeriodStart = startOfQuarter(subQuarters(now, 1))
        previousPeriodEnd = endOfQuarter(subQuarters(now, 1))
        break
      case 'year':
        periodStart = startOfYear(now)
        periodEnd = endOfYear(now)
        previousPeriodStart = startOfYear(subYears(now, 1))
        previousPeriodEnd = endOfYear(subYears(now, 1))
        break
      case 'month':
      default:
        periodStart = startOfMonth(now)
        periodEnd = endOfMonth(now)
        previousPeriodStart = startOfMonth(subMonths(now, 1))
        previousPeriodEnd = endOfMonth(subMonths(now, 1))
        break
    }

    // Active properties
    const activeProperties = await prisma.property.count({
      where: { status: 'active' },
    })

    // Period Revenue (all bookings in current period)
    const periodBookings = await prisma.booking.findMany({
      where: {
        checkInDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    // Period Revenue = gross revenue (baseAmount + cleaningFee) in GHS (display currency)
    let periodRevenue = 0
    for (const booking of periodBookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const grossInGHS = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        'GHS'
      )
      periodRevenue += grossInGHS
    }

    // Period Expenses (convert to GHS for display)
    const periodExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    let periodExpensesTotal = 0
    for (const expense of periodExpenses) {
      const amountInGHS = await convertCurrency(
        expense.amount,
        expense.currency,
        'GHS'
      )
      periodExpensesTotal += amountInGHS
    }

    // Period Commission (calculated on gross revenue: baseAmount + cleaningFee) in GHS
    let periodCommission = 0
    for (const booking of periodBookings) {
      const property = await prisma.property.findUnique({
        where: { id: booking.propertyId },
      })
      if (property) {
        const commissionRate = property.defaultCommissionRate || 0.15
        const grossBookingAmount = booking.baseAmount + booking.cleaningFee
        const grossInGHS = await convertCurrency(
          grossBookingAmount,
          booking.currency,
          'GHS'
        )
        periodCommission += grossInGHS * commissionRate
      }
    }

    // Total owner balances
    const wallets = await prisma.ownerWallet.findMany()
    const totalBalances = wallets.reduce(
      (sum, wallet) => sum + wallet.currentBalance,
      0
    )

    // Total commissions receivable (commissions payable by owners)
    const totalCommissionsReceivable = wallets.reduce(
      (sum, wallet) => sum + (wallet.commissionsPayable || 0),
      0
    )

    // Previous period for comparison
    const prevPeriodBookings = await prisma.booking.findMany({
      where: {
        checkInDate: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
    })

    let prevPeriodRevenue = 0
    for (const booking of prevPeriodBookings) {
      const grossBookingAmount = booking.baseAmount + booking.cleaningFee
      const grossInGHS = await convertCurrency(
        grossBookingAmount,
        booking.currency,
        'GHS'
      )
      prevPeriodRevenue += grossInGHS
    }

    // Previous period expenses
    const prevPeriodExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
    })

    let prevPeriodExpensesTotal = 0
    for (const expense of prevPeriodExpenses) {
      const amountInGHS = await convertCurrency(
        expense.amount,
        expense.currency,
        'GHS'
      )
      prevPeriodExpensesTotal += amountInGHS
    }

    // Previous period commission
    let prevPeriodCommission = 0
    for (const booking of prevPeriodBookings) {
      const property = await prisma.property.findUnique({
        where: { id: booking.propertyId },
      })
      if (property) {
        const commissionRate = property.defaultCommissionRate || 0.15
        const grossBookingAmount = booking.baseAmount + booking.cleaningFee
        const grossInGHS = convertCurrency(
          grossBookingAmount,
          booking.currency,
          'GHS'
        )
        prevPeriodCommission += grossInGHS * commissionRate
      }
    }

    // Generate daily revenue data for last 30 days (regardless of period)
    const last30DaysStart = new Date(now)
    last30DaysStart.setDate(last30DaysStart.getDate() - 30)
    const last30Days = eachDayOfInterval({
      start: last30DaysStart,
      end: now,
    })

    const dailyRevenueData = await Promise.all(
      last30Days.map(async (day) => {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)
        
        const dayBookings = await prisma.booking.findMany({
          where: {
            checkInDate: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        })

        let dayRevenue = 0
        for (const booking of dayBookings) {
          const grossBookingAmount = booking.baseAmount + booking.cleaningFee
          const grossInGHS = await convertCurrency(
            grossBookingAmount,
            booking.currency,
            'GHS'
          )
          dayRevenue += grossInGHS
        }

        return dayRevenue
      })
    )

    // Generate period-based revenue/expense chart data
    const periodDays = eachDayOfInterval({
      start: periodStart,
      end: periodEnd,
    })

    const revenueExpenseChartData = await Promise.all(
      periodDays.map(async (day) => {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        // Revenue for this day
        const dayBookings = await prisma.booking.findMany({
          where: {
            checkInDate: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        })

        let dayRevenue = 0
        for (const booking of dayBookings) {
          const grossBookingAmount = booking.baseAmount + booking.cleaningFee
          const grossInGHS = await convertCurrency(
            grossBookingAmount,
            booking.currency,
            'GHS'
          )
          dayRevenue += grossInGHS
        }

        // Expenses for this day
        const dayExpenses = await prisma.expense.findMany({
          where: {
            date: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        })

        let dayExpensesTotal = 0
        for (const expense of dayExpenses) {
          const amountInGHS = await convertCurrency(
            expense.amount,
            expense.currency,
            'GHS'
          )
          dayExpensesTotal += amountInGHS
        }

        return {
          label: format(day, period === 'week' ? 'EEE' : period === 'month' ? 'MMM dd' : period === 'quarter' ? 'MMM dd' : 'MMM'),
          revenue: dayRevenue,
          expenses: dayExpensesTotal,
        }
      })
    )

    // Booking trends (bookings per day)
    const bookingTrendsData = await Promise.all(
      periodDays.map(async (day) => {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        const dayBookings = await prisma.booking.count({
          where: {
            checkInDate: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        })

        return {
          label: format(day, period === 'week' ? 'EEE' : period === 'month' ? 'MMM dd' : period === 'quarter' ? 'MMM dd' : 'MMM'),
          value: dayBookings,
        }
      })
    )

    // Expense breakdown by category
    const expenseByCategory: Record<string, number> = {}
    for (const expense of periodExpenses) {
      const category = expense.category || 'OTHER'
      const amountInGHS = await convertCurrency(
        expense.amount,
        expense.currency,
        'GHS'
      )
      if (!expenseByCategory[category]) {
        expenseByCategory[category] = 0
      }
      expenseByCategory[category] += amountInGHS
    }

    const expenseBreakdown = Object.entries(expenseByCategory).map(([category, amount]) => ({
      label: category,
      value: amount,
    }))

    // Recent bookings - use capitalized relation names as per Prisma schema
    const recentBookings = await prisma.booking.findMany({
      take: 10,
      orderBy: { checkInDate: 'desc' },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        Owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Upcoming bookings (future check-in dates)
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        checkInDate: {
          gte: now,
        },
      },
      take: 10,
      orderBy: { checkInDate: 'asc' },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        Owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Top performing properties (by revenue this month)
    const allProperties = await prisma.property.findMany({
      where: { status: 'active' },
      include: {
        Owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const propertiesWithRevenue = await Promise.all(
      allProperties.map(async (property) => {
        const propertyBookings = await prisma.booking.findMany({
          where: {
            propertyId: property.id,
            checkInDate: {
              gte: periodStart,
              lte: periodEnd,
            },
            status: 'COMPLETED',
          },
        })

        // Calculate revenue and occupancy
        let revenue = 0
        let totalNights = 0
        for (const booking of propertyBookings) {
          const grossBookingAmount = (booking.baseAmount || 0) + (booking.cleaningFee || 0)
          const grossInGHS = await convertCurrency(
            grossBookingAmount,
            booking.currency,
            'GHS'
          )
          revenue += isNaN(grossInGHS) ? 0 : grossInGHS
          totalNights += booking.nights || 0
        }

        // Calculate occupancy based on period length
        const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
        const occupancy = daysInPeriod > 0 ? (totalNights / daysInPeriod) * 100 : 0

        // Previous period revenue for comparison
        const prevPropertyBookings = await prisma.booking.findMany({
          where: {
            propertyId: property.id,
            checkInDate: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
            status: 'COMPLETED',
          },
        })

        let prevRevenue = 0
        for (const booking of prevPropertyBookings) {
          const grossBookingAmount = (booking.baseAmount || 0) + (booking.cleaningFee || 0)
          const grossInGHS = await convertCurrency(
            grossBookingAmount,
            booking.currency,
            'GHS'
          )
          prevRevenue += isNaN(grossInGHS) ? 0 : grossInGHS
        }

        const revenueChange = prevRevenue > 0 
          ? ((revenue - prevRevenue) / prevRevenue) * 100 
          : (revenue > 0 ? 100 : 0)

        return {
          id: property.id,
          name: property.nickname || property.name,
          revenue: isNaN(revenue) ? 0 : revenue,
          occupancy: Math.min(occupancy, 100),
          revenueChange: isNaN(revenueChange) ? 0 : revenueChange,
          ownerName: property.Owner.name,
        }
      })
    )

    // Sort by revenue and take top 5
    const topProperties = propertiesWithRevenue
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Owner balances with details
    const ownersWithBalances = await Promise.all(
      wallets.map(async (wallet) => {
        const owner = await prisma.owner.findUnique({
          where: { id: wallet.ownerId },
          include: {
            Property: {
              where: { status: 'active' },
            },
          },
        })

        if (!owner) return null

        return {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          propertyCount: owner.Property.length,
          currentBalance: wallet.currentBalance || 0,
          commissionsPayable: wallet.commissionsPayable || 0,
          netBalance: (wallet.currentBalance || 0) - (wallet.commissionsPayable || 0),
        }
      })
    )

    const ownerBalances = ownersWithBalances
      .filter((owner): owner is NonNullable<typeof owner> => owner !== null)
      .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
      .slice(0, 5)

    // Issue metrics
    const openIssues = await prisma.issue.count({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
      },
    })

    const urgentIssues = await prisma.issue.count({
      where: {
        priority: 'URGENT',
        status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
      },
    })

    const periodIssues = await prisma.issue.count({
      where: {
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    // Task metrics
    const pendingTasks = await prisma.task.count({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
    })

    const overdueTasks = await prisma.task.count({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
        dueAt: {
          lt: now,
        },
      },
    })

    const periodTasks = await prisma.task.count({
      where: {
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    })

    // Recent activity (bookings, issues, tasks, expenses)
    const recentIssues = await prisma.issue.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
    })

    const recentTasks = await prisma.task.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
    })

    const recentExpenses = await prisma.expense.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
      },
    })

    // Inventory metrics
    const lowStockItems = await (prisma as any).inventoryItem.findMany({
      where: {
        type: 'CONSUMABLE',
        quantity: { not: null },
        minimumQuantity: { not: null },
      },
      include: {
        Property: {
          select: {
            name: true,
            nickname: true,
          },
        },
      },
    })
    const lowStockCount = lowStockItems.filter((item: any) => 
      item.quantity !== null && 
      item.minimumQuantity !== null && 
      item.quantity <= item.minimumQuantity
    ).length

    // Cleaning tasks metrics
    const pendingCleaningTasks = await prisma.task.count({
      where: {
        type: 'CLEANING',
        status: 'PENDING',
      },
    })

    const allCleaningTasks = await prisma.task.findMany({
      where: {
        type: 'CLEANING',
      },
    })
    const readyForGuestTasks = allCleaningTasks.filter((t: any) => t.isReadyForGuest === true).length

    // Check-in metrics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const allUpcomingBookings = await prisma.booking.findMany({
      where: {
        checkInDate: {
          gte: today,
          lte: nextWeek,
        },
      },
      include: {
        Property: {
          select: {
            name: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        checkInDate: 'asc',
      },
    })
    const upcomingCheckIns = allUpcomingBookings.filter((b: any) => !b.checkedInAt).slice(0, 5)

    const allRecentBookings = await prisma.booking.findMany({
      include: {
        Property: {
          select: {
            name: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        checkInDate: 'desc',
      },
      take: 20,
    })
    
    const recentCheckInsRaw = allRecentBookings.filter((b: any) => b.checkedInAt !== null).slice(0, 5)

    // Fetch checked-in users separately
    const checkedInUserIds = recentCheckInsRaw
      .map((b: any) => b.checkedInById)
      .filter((id): id is string => id !== null && id !== undefined)
    const uniqueUserIds = [...new Set(checkedInUserIds)]
    
    const checkedInUsers = uniqueUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: {
            id: true,
            name: true,
          },
        })
      : []
    
    const userMap = new Map(checkedInUsers.map(u => [u.id, u]))
    const recentCheckIns = recentCheckInsRaw.map((booking: any) => ({
      ...booking,
      CheckedInBy: booking.checkedInById ? userMap.get(booking.checkedInById) : null,
    }))

    // Electricity metrics
    const lowElectricityBalances = await (prisma as any).electricityMeterReading.findMany({
      where: {
        readingDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      include: {
        Property: {
          select: {
            name: true,
            nickname: true,
            electricityMeterMinimumBalance: true,
          },
        },
      },
      orderBy: {
        readingDate: 'desc',
      },
    })

    const lowBalanceCount = lowElectricityBalances.filter((reading: any) => {
      const property = reading.Property
      return property.electricityMeterMinimumBalance !== null && 
             reading.balance <= property.electricityMeterMinimumBalance
    }).length

    // Recent inventory updates
    const recentInventoryUpdates = await (prisma as any).inventoryHistory.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        InventoryItem: {
          include: {
            Property: {
              select: {
                name: true,
                nickname: true,
              },
            },
          },
        },
        ChangedBy: {
          select: {
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      activeProperties,
      mtdRevenue: isNaN(periodRevenue) ? 0 : periodRevenue,
      mtdExpenses: isNaN(periodExpensesTotal) ? 0 : periodExpensesTotal,
      mtdCommission: isNaN(periodCommission) ? 0 : periodCommission,
      totalBalances: isNaN(totalBalances) ? 0 : totalBalances,
      totalCommissionsReceivable: isNaN(totalCommissionsReceivable) ? 0 : totalCommissionsReceivable,
      recentBookings,
      upcomingBookings,
      topProperties,
      ownerBalances,
      trends: {
        revenue: {
          current: isNaN(periodRevenue) ? 0 : periodRevenue,
          previous: isNaN(prevPeriodRevenue) ? 0 : prevPeriodRevenue,
          change: isNaN(periodRevenue) || isNaN(prevPeriodRevenue) 
            ? 0 
            : prevPeriodRevenue > 0 
              ? ((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100 
              : (periodRevenue > 0 ? 100 : 0),
        },
        expenses: {
          current: isNaN(periodExpensesTotal) ? 0 : periodExpensesTotal,
          previous: isNaN(prevPeriodExpensesTotal) ? 0 : prevPeriodExpensesTotal,
          change: isNaN(periodExpensesTotal) || isNaN(prevPeriodExpensesTotal)
            ? 0
            : prevPeriodExpensesTotal > 0
              ? ((periodExpensesTotal - prevPeriodExpensesTotal) / prevPeriodExpensesTotal) * 100
              : (periodExpensesTotal > 0 ? 100 : 0),
        },
        commission: {
          current: isNaN(periodCommission) ? 0 : periodCommission,
          previous: isNaN(prevPeriodCommission) ? 0 : prevPeriodCommission,
          change: isNaN(periodCommission) || isNaN(prevPeriodCommission)
            ? 0
            : prevPeriodCommission > 0
              ? ((periodCommission - prevPeriodCommission) / prevPeriodCommission) * 100
              : (periodCommission > 0 ? 100 : 0),
        },
      },
      dailyRevenueData: dailyRevenueData.map(d => isNaN(d) ? 0 : d),
      // Chart data
      revenueExpenseChart: revenueExpenseChartData,
      bookingTrends: bookingTrendsData,
      expenseBreakdown: expenseBreakdown,
      // Issue metrics
      openIssues,
      urgentIssues,
      mtdIssues: periodIssues,
      // Task metrics
      pendingTasks,
      overdueTasks,
      mtdTasks: periodTasks,
      // Recent activity
      recentIssues: recentIssues.map(issue => ({
        id: issue.id,
        type: 'issue',
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        propertyName: issue.Property?.nickname || issue.Property?.name || 'Unknown',
        createdAt: issue.createdAt,
      })),
      recentTasks: recentTasks.map(task => ({
        id: task.id,
        type: 'task',
        title: task.title,
        status: task.status,
        propertyName: task.Property?.nickname || task.Property?.name || 'Unknown',
        createdAt: task.createdAt,
      })),
      recentExpenses: recentExpenses.map(expense => ({
        id: expense.id,
        type: 'expense',
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        propertyName: expense.Property?.nickname || expense.Property?.name || 'Unknown',
        date: expense.date,
      })),
      // New feature metrics
      lowStockItems: lowStockCount,
      pendingCleaningTasks,
      readyForGuestTasks,
      upcomingCheckIns: upcomingCheckIns.map(booking => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        guestName: booking.guestName,
        propertyName: booking.Property?.nickname || booking.Property?.name || 'Unknown',
        propertyId: booking.propertyId,
      })),
      recentCheckIns: recentCheckIns.map((booking: any) => ({
        id: booking.id,
        checkInDate: booking.checkInDate,
        checkedInAt: booking.checkedInAt,
        guestName: booking.guestName,
        propertyName: booking.Property?.nickname || booking.Property?.name || 'Unknown',
        checkedInBy: booking.CheckedInBy?.name || 'Unknown',
        propertyId: booking.propertyId,
      })),
      lowElectricityBalances: lowBalanceCount,
      recentInventoryUpdates: recentInventoryUpdates.map((update: any) => ({
        id: update.id,
        itemName: update.InventoryItem.name,
        propertyName: update.InventoryItem.Property?.nickname || update.InventoryItem.Property?.name || 'Unknown',
        previousQuantity: update.previousQuantity,
        newQuantity: update.newQuantity,
        changeType: update.changeType,
        changedBy: update.ChangedBy?.name || 'Unknown',
        createdAt: update.createdAt,
      })),
    })
  } catch (error) {
    console.error('[Admin Metrics] Error:', error)
    console.error('[Admin Metrics] Error stack:', (error as any)?.stack)
    const status = typeof (error as any)?.status === 'number' ? (error as any).status : 500
    const message = error instanceof Error ? error.message : 'Failed to fetch metrics'
    const stack = process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { error: message, details: stack },
      { status }
    )
  }
}
