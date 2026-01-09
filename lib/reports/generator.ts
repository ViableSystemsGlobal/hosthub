/**
 * Report Generator
 * Handles data aggregation and formatting for various report types
 */

import { prisma } from '@/lib/prisma'
import { formatCurrency, Currency, getFxRate } from '@/lib/currency'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'

/**
 * Convert USD to GHS using historical rates from bookings
 * Uses each booking's fxRateToBase to determine the historical rate
 */
async function convertUSDToGHSHistorical(
  bookings: Array<{ currency: Currency; fxRateToBase: number; totalPayoutInBase: number }>
): Promise<number> {
  if (bookings.length === 0) return 0
  
  // Get current USD→GHS rate for USD bookings (limitation: we don't store historical USD→GHS rates)
  const currentUsdToGhs = await getFxRate('USD', 'GHS')
  
  let totalGHS = 0
  
  for (const booking of bookings) {
    const usdAmount = booking.totalPayoutInBase || 0
    
    if (booking.currency === 'GHS') {
      // If booking was in GHS, fxRateToBase is GHS→USD rate
      // To get USD→GHS, we invert it: 1 / fxRateToBase
      const usdToGhsRate = booking.fxRateToBase > 0 ? 1 / booking.fxRateToBase : 0
      totalGHS += usdAmount * usdToGhsRate
    } else if (booking.currency === 'USD') {
      // If booking was in USD, fxRateToBase should be 1.0
      // We use current rate as fallback (limitation: no historical USD→GHS rate stored)
      totalGHS += usdAmount * currentUsdToGhs
    }
  }
  
  return totalGHS
}

export interface ReportFilters {
  dateFrom?: string
  dateTo?: string
  propertyIds?: string[]
  ownerIds?: string[]
  status?: string[]
  [key: string]: any
}

export interface ReportField {
  key: string
  label: string
  type: 'string' | 'number' | 'currency' | 'date' | 'boolean'
}

export interface ReportData {
  headers: string[]
  rows: any[][]
  summary?: Record<string, any>
}

/**
 * Generate bookings report
 */
export async function generateBookingsReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {}

  // Date filters
  if (filters.dateFrom || filters.dateTo) {
    where.checkInDate = {}
    if (filters.dateFrom) {
      where.checkInDate.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.checkInDate.lte = new Date(filters.dateTo)
    }
  }

  // Property filters
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  // Owner filters
  if (filters.ownerIds && filters.ownerIds.length > 0) {
    where.ownerId = { in: filters.ownerIds }
  }

  // Status filters
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      Owner: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      checkInDate: 'desc',
    },
  })

  // Default fields if none specified
  const defaultFields = [
    'checkInDate',
    'checkOutDate',
    'guestName',
    'property',
    'owner',
    'nights',
    'revenue', // Show revenue in GHS (converted from USD using historical rates)
    'status',
    'source',
  ]

  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  // Build headers
  const headers = selectedFields.map((field) => {
    const fieldMap: Record<string, string> = {
      checkInDate: 'Check-in',
      checkOutDate: 'Check-out',
      guestName: 'Guest',
      property: 'Property',
      owner: 'Owner',
      nights: 'Nights',
      revenue: 'Revenue',
      totalPayout: 'Payout',
      currency: 'Currency',
      status: 'Status',
      source: 'Source',
      baseAmount: 'Base Amount',
      cleaningFee: 'Cleaning Fee',
      platformFees: 'Platform Fees',
      taxes: 'Taxes',
      totalPayoutInBase: 'Payout (Base Currency)',
    }
    return fieldMap[field] || field
  })

  // Build rows - need to fetch fxRateToBase for historical conversion
  const rows = await Promise.all(
    bookings.map(async (booking) => {
      return await Promise.all(
        selectedFields.map(async (field) => {
          switch (field) {
            case 'checkInDate':
              return booking.checkInDate ? format(new Date(booking.checkInDate), 'yyyy-MM-dd') : ''
            case 'checkOutDate':
              return booking.checkOutDate ? format(new Date(booking.checkOutDate), 'yyyy-MM-dd') : ''
            case 'guestName':
              return booking.guestName || ''
            case 'property':
              return booking.Property?.nickname || booking.Property?.name || ''
            case 'owner':
              return booking.Owner?.name || ''
            case 'revenue':
              // Convert totalPayoutInBase from USD to GHS using historical rate from this booking
              const revenueUsdToGhsRate = booking.currency === 'GHS' && booking.fxRateToBase > 0
                ? 1 / booking.fxRateToBase
                : await getFxRate('USD', 'GHS')
              return formatCurrency(booking.totalPayoutInBase * revenueUsdToGhsRate, Currency.GHS)
            case 'totalPayout':
              return formatCurrency(booking.totalPayout, booking.currency as Currency)
            case 'totalPayoutInBase':
              // Convert from USD to GHS using historical rate from this booking
              const usdToGhsRate = booking.currency === 'GHS' && booking.fxRateToBase > 0
                ? 1 / booking.fxRateToBase
                : await getFxRate('USD', 'GHS')
              return formatCurrency(booking.totalPayoutInBase * usdToGhsRate, Currency.GHS)
            case 'baseAmount':
              return formatCurrency(booking.baseAmount, booking.currency as Currency)
            case 'cleaningFee':
              return formatCurrency(booking.cleaningFee, booking.currency as Currency)
            case 'platformFees':
              return formatCurrency(booking.platformFees, booking.currency as Currency)
            case 'taxes':
              return formatCurrency(booking.taxes, booking.currency as Currency)
            default:
              return (booking as any)[field]?.toString() || ''
          }
        })
      )
    })
  )

  // Calculate totals by currency
  const totalsByOriginalCurrency: Record<string, number> = {}
  bookings.forEach((b) => {
    const curr = b.currency as string
    if (!totalsByOriginalCurrency[curr]) {
      totalsByOriginalCurrency[curr] = 0
    }
    totalsByOriginalCurrency[curr] += b.totalPayout
  })

  // Summary with both original currency totals and base currency total
  const totalRevenueInBase = bookings.reduce((sum, b) => sum + b.totalPayoutInBase, 0)
  const totalNights = bookings.reduce((sum, b) => sum + b.nights, 0)
  
  // Format currency totals for display
  const currencyTotals = Object.entries(totalsByOriginalCurrency)
    .map(([currency, amount]) => `${formatCurrency(amount, currency as Currency)}`)
    .join(' + ')

  const summary = {
    'Total Bookings': bookings.length,
    'Total Nights': totalNights,
    'Total Revenue': currencyTotals || formatCurrency(0, Currency.GHS),
    'Total Revenue (USD)': formatCurrency(totalRevenueInBase, Currency.USD),
    'Average Nights': bookings.length > 0 ? (totalNights / bookings.length).toFixed(2) : '0',
    'Average Revenue (USD)': bookings.length > 0 
      ? formatCurrency(totalRevenueInBase / bookings.length, Currency.USD) 
      : formatCurrency(0, Currency.USD),
  }

  return { headers, rows, summary }
}

/**
 * Generate revenue report
 */
export async function generateRevenueReport(
  filters: ReportFilters,
  groupBy: 'month' | 'property' | 'owner' | 'none' = 'month'
): Promise<ReportData> {
  const where: any = {}

  if (filters.dateFrom || filters.dateTo) {
    where.checkInDate = {}
    if (filters.dateFrom) {
      where.checkInDate.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.checkInDate.lte = new Date(filters.dateTo)
    }
  }

  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  if (filters.ownerIds && filters.ownerIds.length > 0) {
    where.ownerId = { in: filters.ownerIds }
  }

  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status }
  } else {
    where.status = 'COMPLETED' // Revenue reports typically only show completed bookings
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      Owner: {
        select: {
          name: true,
        },
      },
    },
  })

  let groupedData: Record<string, any> = {}
  
  // Track totals by original currency
  const totalsByOriginalCurrency: Record<string, number> = {}

  bookings.forEach((booking) => {
    let key = ''
    switch (groupBy) {
      case 'month':
        key = format(new Date(booking.checkInDate), 'yyyy-MM')
        break
      case 'property':
        key = booking.Property?.nickname || booking.Property?.name || booking.propertyId
        break
      case 'owner':
        key = booking.Owner?.name || booking.ownerId
        break
      default:
        key = 'all'
    }

    if (!groupedData[key]) {
      groupedData[key] = {
        key,
        bookings: 0,
        nights: 0,
        revenue: 0,
      }
    }

    groupedData[key].bookings += 1
    groupedData[key].nights += booking.nights
    groupedData[key].revenue += booking.totalPayoutInBase
    
    // Track by original currency
    const curr = booking.currency as string
    if (!totalsByOriginalCurrency[curr]) {
      totalsByOriginalCurrency[curr] = 0
    }
    totalsByOriginalCurrency[curr] += booking.totalPayout
  })

  const headers = groupBy === 'none' 
    ? ['Total Revenue', 'Total Bookings', 'Total Nights', 'Average per Booking']
    : groupBy === 'month'
    ? ['Month', 'Revenue', 'Bookings', 'Nights', 'Avg per Booking']
    : groupBy === 'property'
    ? ['Property', 'Revenue', 'Bookings', 'Nights', 'Avg per Booking']
    : ['Owner', 'Revenue', 'Bookings', 'Nights', 'Avg per Booking']

  // Convert grouped revenue from USD to GHS using historical rates
  // We need to track which bookings are in each group
  const bookingsByGroup: Record<string, typeof bookings> = {}
  bookings.forEach((booking) => {
    let key = ''
    switch (groupBy) {
      case 'month':
        key = format(new Date(booking.checkInDate), 'yyyy-MM')
        break
      case 'property':
        key = booking.Property?.nickname || booking.Property?.name || booking.propertyId
        break
      case 'owner':
        key = booking.Owner?.name || booking.ownerId
        break
      default:
        key = 'all'
    }
    if (!bookingsByGroup[key]) {
      bookingsByGroup[key] = []
    }
    bookingsByGroup[key].push(booking)
  })

  const rows = await Promise.all(
    Object.values(groupedData).map(async (group: any) => {
      // Convert revenue from USD to GHS using historical rates for this group
      const groupBookings = bookingsByGroup[group.key] || []
      const revenueInGHS = await convertUSDToGHSHistorical(
        groupBookings.map(b => ({
          currency: b.currency,
          fxRateToBase: b.fxRateToBase || 1.0,
          totalPayoutInBase: b.totalPayoutInBase || 0,
        }))
      )
      const avgRevenue = group.bookings > 0 ? revenueInGHS / group.bookings : 0
      
      if (groupBy === 'none') {
        return [
          formatCurrency(revenueInGHS, Currency.GHS),
          group.bookings.toString(),
          group.nights.toString(),
          formatCurrency(avgRevenue, Currency.GHS),
        ]
      }
      return [
        group.key,
        formatCurrency(revenueInGHS, Currency.GHS),
        group.bookings.toString(),
        group.nights.toString(),
        formatCurrency(avgRevenue, Currency.GHS),
      ]
    })
  )

  const totalRevenueUSD = Object.values(groupedData).reduce((sum: number, g: any) => sum + g.revenue, 0)
  const totalBookings = Object.values(groupedData).reduce((sum: number, g: any) => sum + g.bookings, 0)
  const totalNights = Object.values(groupedData).reduce((sum: number, g: any) => sum + g.nights, 0)

  // Convert total revenue from USD to GHS using historical rates
  const totalRevenueInGHS = await convertUSDToGHSHistorical(
    bookings.map(b => ({
      currency: b.currency,
      fxRateToBase: b.fxRateToBase || 1.0,
      totalPayoutInBase: b.totalPayoutInBase || 0,
    }))
  )

  // Format currency totals for display
  const currencyTotals = Object.entries(totalsByOriginalCurrency)
    .map(([currency, amount]) => `${formatCurrency(amount, currency as Currency)}`)
    .join(' + ')

  const summary = {
    'Total Bookings': totalBookings,
    'Total Nights': totalNights,
    'Total Revenue': currencyTotals || formatCurrency(0, Currency.GHS),
    'Total Revenue (GHS)': formatCurrency(totalRevenueInGHS, Currency.GHS),
    'Total Revenue (USD)': formatCurrency(totalRevenueUSD, Currency.USD),
    'Average Revenue (USD)': totalBookings > 0 
      ? formatCurrency(totalRevenueUSD / totalBookings, Currency.USD) 
      : formatCurrency(0, Currency.USD),
    'Note': 'Revenue Report shows COMPLETED bookings only',
  }

  return { headers, rows, summary }
}

/**
 * Generate expenses report
 */
export async function generateExpensesReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {}

  if (filters.dateFrom || filters.dateTo) {
    where.date = {}
    if (filters.dateFrom) {
      where.date.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.date.lte = new Date(filters.dateTo)
    }
  }

  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      Task: {
        select: {
          title: true,
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  })

  const defaultFields = ['date', 'description', 'property', 'category', 'amount', 'currency', 'task']
  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  const headers = selectedFields.map((field) => {
    const fieldMap: Record<string, string> = {
      date: 'Date',
      description: 'Description',
      property: 'Property',
      category: 'Category',
      amount: 'Amount',
      currency: 'Currency',
      task: 'Related Task',
    }
    return fieldMap[field] || field
  })

  const rows = expenses.map((expense) => {
    return selectedFields.map((field) => {
      switch (field) {
        case 'date':
          return expense.date ? format(new Date(expense.date), 'yyyy-MM-dd') : ''
        case 'property':
          return expense.Property?.nickname || expense.Property?.name || ''
        case 'amount':
          return formatCurrency(expense.amount, expense.currency as Currency)
        case 'task':
          return expense.Task?.title || ''
        default:
          return (expense as any)[field]?.toString() || ''
      }
    })
  })

  const summary = {
    totalExpenses: expenses.length,
    totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
    averageAmount: expenses.length > 0 ? expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length : 0,
  }

  return { headers, rows, summary }
}

/**
 * Generate occupancy report
 */
export async function generateOccupancyReport(
  filters: ReportFilters,
  groupBy: 'month' | 'property' = 'month'
): Promise<ReportData> {
  const where: any = {
    status: 'COMPLETED',
  }

  if (filters.dateFrom || filters.dateTo) {
    where.checkInDate = {}
    if (filters.dateFrom) {
      where.checkInDate.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.checkInDate.lte = new Date(filters.dateTo)
    }
  }

  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
    },
  })

  // Calculate occupancy by month or property
  const groupedData: Record<string, any> = {}

  bookings.forEach((booking) => {
    const key = groupBy === 'month'
      ? format(new Date(booking.checkInDate), 'yyyy-MM')
      : booking.Property?.nickname || booking.Property?.name || booking.propertyId

    if (!groupedData[key]) {
      groupedData[key] = {
        key,
        nights: 0,
        bookings: 0,
      }
    }

    groupedData[key].nights += booking.nights
    groupedData[key].bookings += 1
  })

  // Calculate days in period for occupancy percentage
  const startDate = filters.dateFrom ? new Date(filters.dateFrom) : startOfMonth(subMonths(new Date(), 12))
  const endDate = filters.dateTo ? new Date(filters.dateTo) : endOfMonth(new Date())
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const headers = groupBy === 'month'
    ? ['Month', 'Booked Nights', 'Bookings', 'Occupancy %']
    : ['Property', 'Booked Nights', 'Bookings', 'Occupancy %']

  const rows = Object.values(groupedData).map((group: any) => {
    // Calculate occupancy percentage (simplified - assumes 1 property per period)
    const daysInPeriod = groupBy === 'month' ? 30 : totalDays
    const occupancyPercent = daysInPeriod > 0 ? (group.nights / daysInPeriod) * 100 : 0

    return [
      group.key,
      group.nights.toString(),
      group.bookings.toString(),
      `${occupancyPercent.toFixed(1)}%`,
    ]
  })

  const summary = {
    totalNights: Object.values(groupedData).reduce((sum: number, g: any) => sum + g.nights, 0),
    totalBookings: Object.values(groupedData).reduce((sum: number, g: any) => sum + g.bookings, 0),
  }

  return { headers, rows, summary }
}

/**
 * Generate inventory report
 */
export async function generateInventoryReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {}

  // Property filters
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  // Type filter
  if (filters.type) {
    where.type = filters.type
  }

  // Low stock filter - handled in post-processing since Prisma doesn't support field comparison in where
  const inventory = await prisma.inventoryItem.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      LastCheckedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { type: 'asc' },
      { name: 'asc' },
    ],
  })

  // Filter low stock items if requested
  let filteredInventory = inventory
  if (filters.lowStock === true) {
    filteredInventory = inventory.filter(i => 
      i.type === 'CONSUMABLE' && 
      i.quantity !== null && 
      i.minimumQuantity !== null && 
      i.quantity <= i.minimumQuantity
    )
  }

  const defaultFields = [
    'property',
    'name',
    'type',
    'quantity',
    'minimumQuantity',
    'unit',
    'status',
    'lastCheckedAt',
    'lastCheckedBy',
  ]

  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  const headers = selectedFields.map(field => {
    const fieldMap: Record<string, string> = {
      property: 'Property',
      name: 'Item Name',
      type: 'Type',
      quantity: 'Quantity',
      minimumQuantity: 'Minimum',
      unit: 'Unit',
      status: 'Status',
      lastCheckedAt: 'Last Checked',
      lastCheckedBy: 'Checked By',
    }
    return fieldMap[field] || field
  })

  const rows = filteredInventory.map((item) => {
    return selectedFields.map((field) => {
      switch (field) {
        case 'property':
          return item.Property?.nickname || item.Property?.name || '-'
        case 'name':
          return item.name
        case 'type':
          return item.type
        case 'quantity':
          return item.quantity?.toString() || '-'
        case 'minimumQuantity':
          return item.minimumQuantity?.toString() || '-'
        case 'unit':
          return item.unit || '-'
        case 'status':
          return item.status
        case 'lastCheckedAt':
          return item.lastCheckedAt ? format(new Date(item.lastCheckedAt), 'yyyy-MM-dd') : 'Never'
        case 'lastCheckedBy':
          return item.LastCheckedBy?.name || '-'
        default:
          return '-'
      }
    })
  })

  const summary = {
    totalItems: filteredInventory.length,
    consumableItems: filteredInventory.filter(i => i.type === 'CONSUMABLE').length,
    stationaryItems: filteredInventory.filter(i => i.type === 'STATIONARY').length,
    lowStockItems: filteredInventory.filter(i => 
      i.type === 'CONSUMABLE' && 
      i.quantity !== null && 
      i.minimumQuantity !== null && 
      i.quantity <= i.minimumQuantity
    ).length,
  }

  return { headers, rows, summary }
}

/**
 * Generate cleaning tasks report
 */
export async function generateCleaningTasksReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {
    type: 'CLEANING',
  }

  // Date filters
  if (filters.dateFrom || filters.dateTo) {
    where.scheduledAt = {}
    if (filters.dateFrom) {
      where.scheduledAt.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.scheduledAt.lte = new Date(filters.dateTo)
    }
  }

  // Property filters
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  // Status filters
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
    },
    orderBy: {
      scheduledAt: 'desc',
    },
  })

  // Fetch assigned users separately if needed
  const assignedUserIds = tasks
    .map(t => t.assignedToUserId)
    .filter((id): id is string => id !== null && id !== undefined)
  const uniqueUserIds = [...new Set(assignedUserIds)]
  
  const assignedUsers = uniqueUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : []
  
  const userMap = new Map(assignedUsers.map(u => [u.id, u]))

  const defaultFields = [
    'scheduledAt',
    'property',
    'title',
    'status',
    'assignedTo',
    'completedAt',
    'isReadyForGuest',
    'checklistCompleted',
  ]

  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  const headers = selectedFields.map(field => {
    const fieldMap: Record<string, string> = {
      scheduledAt: 'Scheduled Date',
      property: 'Property',
      title: 'Task Title',
      status: 'Status',
      assignedTo: 'Assigned To',
      completedAt: 'Completed At',
      isReadyForGuest: 'Ready for Guest',
      checklistCompleted: 'Checklist Completed',
    }
    return fieldMap[field] || field
  })

  const rows = tasks.map((task) => {
    return selectedFields.map((field) => {
      switch (field) {
        case 'scheduledAt':
          return task.scheduledAt ? format(new Date(task.scheduledAt), 'yyyy-MM-dd') : '-'
        case 'property':
          return task.Property?.nickname || task.Property?.name || '-'
        case 'title':
          return task.title
        case 'status':
          return task.status
        case 'assignedTo':
          return task.assignedToUserId ? (userMap.get(task.assignedToUserId)?.name || '-') : '-'
        case 'completedAt':
          return task.completedAt ? format(new Date(task.completedAt), 'yyyy-MM-dd HH:mm') : '-'
        case 'isReadyForGuest':
          return task.isReadyForGuest ? 'Yes' : 'No'
        case 'checklistCompleted':
          return task.checklistCompletedAt ? format(new Date(task.checklistCompletedAt), 'yyyy-MM-dd') : 'No'
        default:
          return '-'
      }
    })
  })

  const summary = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
    readyForGuest: tasks.filter(t => t.isReadyForGuest === true).length,
    pendingTasks: tasks.filter(t => t.status === 'PENDING').length,
  }

  return { headers, rows, summary }
}

/**
 * Generate check-in report
 */
export async function generateCheckInReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {
    checkedInAt: { not: null },
  }

  // Date filters
  if (filters.dateFrom || filters.dateTo) {
    where.checkedInAt = {
      ...where.checkedInAt,
    }
    if (filters.dateFrom) {
      where.checkedInAt.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.checkedInAt.lte = new Date(filters.dateTo)
    }
  }

  // Property filters
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      CheckedInBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      checkedInAt: 'desc',
    },
  })

  const defaultFields = [
    'checkInDate',
    'checkedInAt',
    'property',
    'guestName',
    'checkedInBy',
    'checkInNotes',
  ]

  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  const headers = selectedFields.map(field => {
    const fieldMap: Record<string, string> = {
      checkInDate: 'Scheduled Check-in',
      checkedInAt: 'Actual Check-in',
      property: 'Property',
      guestName: 'Guest Name',
      checkedInBy: 'Checked In By',
      checkInNotes: 'Notes',
    }
    return fieldMap[field] || field
  })

  const rows = bookings.map((booking) => {
    return selectedFields.map((field) => {
      switch (field) {
        case 'checkInDate':
          return booking.checkInDate ? format(new Date(booking.checkInDate), 'yyyy-MM-dd') : '-'
        case 'checkedInAt':
          return booking.checkedInAt ? format(new Date(booking.checkedInAt), 'yyyy-MM-dd HH:mm') : '-'
        case 'property':
          return booking.Property?.nickname || booking.Property?.name || '-'
        case 'guestName':
          return booking.guestName || '-'
        case 'checkedInBy':
          return booking.CheckedInBy?.name || '-'
        case 'checkInNotes':
          return booking.checkInNotes || '-'
        default:
          return '-'
      }
    })
  })

  const summary = {
    totalCheckIns: bookings.length,
    onTimeCheckIns: bookings.filter(b => {
      if (!b.checkInDate || !b.checkedInAt) return false
      const scheduled = new Date(b.checkInDate)
      const actual = new Date(b.checkedInAt)
      return actual <= scheduled
    }).length,
  }

  return { headers, rows, summary }
}

/**
 * Generate electricity usage report
 */
export async function generateElectricityReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {}

  // Property filters
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  // Date filters
  if (filters.dateFrom || filters.dateTo) {
    where.readingDate = {}
    if (filters.dateFrom) {
      where.readingDate.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.readingDate.lte = new Date(filters.dateTo)
    }
  }

  const readings = await prisma.electricityMeterReading.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
          electricityMeterUnit: true,
          electricityMeterMinimumBalance: true,
        },
      },
      EnteredBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      readingDate: 'desc',
    },
  })

  const defaultFields = [
    'readingDate',
    'property',
    'balance',
    'unit',
    'enteredBy',
    'notes',
  ]

  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  const headers = selectedFields.map(field => {
    const fieldMap: Record<string, string> = {
      readingDate: 'Date',
      property: 'Property',
      balance: 'Balance',
      unit: 'Unit',
      enteredBy: 'Entered By',
      notes: 'Notes',
    }
    return fieldMap[field] || field
  })

  const rows = readings.map((reading) => {
    return selectedFields.map((field) => {
      switch (field) {
        case 'readingDate':
          return format(new Date(reading.readingDate), 'yyyy-MM-dd')
        case 'property':
          return reading.Property?.nickname || reading.Property?.name || '-'
        case 'balance':
          return reading.balance.toString()
        case 'unit':
          return reading.Property?.electricityMeterUnit || 'GHS'
        case 'enteredBy':
          return reading.EnteredBy?.name || '-'
        case 'notes':
          return reading.notes || '-'
        default:
          return '-'
      }
    })
  })

  // Calculate trends
  const propertyReadings: Record<string, any[]> = {}
  readings.forEach(reading => {
    const propId = reading.propertyId
    if (!propertyReadings[propId]) {
      propertyReadings[propId] = []
    }
    propertyReadings[propId].push(reading)
  })

  const summary = {
    totalReadings: readings.length,
    propertiesTracked: Object.keys(propertyReadings).length,
    averageBalance: readings.length > 0
      ? readings.reduce((sum, r) => sum + r.balance, 0) / readings.length
      : 0,
    lowBalanceReadings: readings.filter(r => {
      const property = readings.find(rd => rd.propertyId === r.propertyId)?.Property
      return property?.electricityMeterMinimumBalance && r.balance <= property.electricityMeterMinimumBalance
    }).length,
  }

  return { headers, rows, summary }
}

/**
 * Generate issues report
 */
export async function generateIssuesReport(
  filters: ReportFilters,
  fields?: string[]
): Promise<ReportData> {
  const where: any = {}

  // Date filters
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) {
      where.createdAt.gte = new Date(filters.dateFrom)
    }
    if (filters.dateTo) {
      where.createdAt.lte = new Date(filters.dateTo)
    }
  }

  // Property filters
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  // Owner filters (via property)
  if (filters.ownerIds && filters.ownerIds.length > 0) {
    where.Property = {
      ownerId: { in: filters.ownerIds },
    }
  }

  // Status filters
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status }
  }

  const issues = await prisma.issue.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      AssignedContact: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const defaultFields = [
    'createdAt',
    'property',
    'title',
    'description',
    'status',
    'priority',
    'assignedTo',
    'resolvedAt',
  ]

  const selectedFields = fields && fields.length > 0 ? fields : defaultFields

  const headers = selectedFields.map(field => {
    const fieldMap: Record<string, string> = {
      createdAt: 'Date Reported',
      property: 'Property',
      title: 'Title',
      description: 'Description',
      status: 'Status',
      priority: 'Priority',
      assignedTo: 'Assigned To',
      resolvedAt: 'Resolved At',
    }
    return fieldMap[field] || field
  })

  const rows = issues.map((issue) => {
    return selectedFields.map((field) => {
      switch (field) {
        case 'createdAt':
          return format(new Date(issue.createdAt), 'yyyy-MM-dd')
        case 'property':
          return issue.Property?.nickname || issue.Property?.name || '-'
        case 'title':
          return issue.title || '-'
        case 'description':
          return issue.description || '-'
        case 'status':
          return issue.status || '-'
        case 'priority':
          return issue.priority || '-'
        case 'assignedTo':
          return issue.AssignedContact?.name || '-'
        case 'resolvedAt':
          return issue.resolvedAt ? format(new Date(issue.resolvedAt), 'yyyy-MM-dd') : '-'
        default:
          return '-'
      }
    })
  })

  const summary = {
    totalIssues: issues.length,
    openIssues: issues.filter(i => i.status === 'OPEN').length,
    resolvedIssues: issues.filter(i => i.status === 'RESOLVED').length,
    highPriority: issues.filter(i => i.priority === 'HIGH').length,
    mediumPriority: issues.filter(i => i.priority === 'MEDIUM').length,
    lowPriority: issues.filter(i => i.priority === 'LOW').length,
  }

  return { headers, rows, summary }
}

