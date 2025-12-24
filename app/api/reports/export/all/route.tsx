import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import {
  generateBookingsReport,
  generateRevenueReport,
  generateExpensesReport,
  generateOccupancyReport,
  generateInventoryReport,
  generateCleaningTasksReport,
  generateCheckInReport,
  generateElectricityReport,
} from '@/lib/reports/generator'
import { renderToBuffer } from '@react-pdf/renderer'
import { AllReportsPDF } from '@/components/pdf/all-reports-pdf'

const allReportTypes = [
  'BOOKINGS',
  'EXPENSES',
  'REVENUE',
  'OCCUPANCY',
  'INVENTORY',
  'CLEANING_TASKS',
  'CHECK_IN',
  'ELECTRICITY',
] as const

const reportTitles: Record<string, string> = {
  BOOKINGS: 'Bookings',
  EXPENSES: 'Expenses',
  REVENUE: 'Revenue',
  OCCUPANCY: 'Occupancy',
  INVENTORY: 'Inventory',
  CLEANING_TASKS: 'Cleaning Tasks',
  CHECK_IN: 'Check-Ins',
  ELECTRICITY: 'Electricity',
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { filters, grouping, dateFrom, dateTo } = body || {}

    // Owner scope restriction
    let finalFilters = filters || {}
    if (user.role === 'OWNER' && user.ownerId) {
      const ownerProperties = await prisma.property.findMany({
        where: { ownerId: user.ownerId },
        select: { id: true },
      })
      const propertyIds = ownerProperties.map((p) => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json({ error: 'No properties found' }, { status: 400 })
      }
      finalFilters = {
        ...finalFilters,
        propertyIds: finalFilters.propertyIds
          ? finalFilters.propertyIds.filter((id: string) => propertyIds.includes(id))
          : propertyIds,
        ownerIds: [user.ownerId],
      }
    }

    const results: Record<string, any> = {}

    for (const rt of allReportTypes) {
      let data
      switch (rt) {
        case 'BOOKINGS':
          data = await generateBookingsReport(finalFilters, undefined)
          break
        case 'REVENUE':
          data = await generateRevenueReport(finalFilters, grouping || 'month')
          break
        case 'EXPENSES':
          data = await generateExpensesReport(finalFilters, undefined)
          break
        case 'OCCUPANCY':
          data = await generateOccupancyReport(finalFilters, grouping || 'month')
          break
        case 'INVENTORY':
          data = await generateInventoryReport(finalFilters, undefined)
          break
        case 'CLEANING_TASKS':
          data = await generateCleaningTasksReport(finalFilters, undefined)
          break
        case 'CHECK_IN':
          data = await generateCheckInReport(finalFilters, undefined)
          break
        case 'ELECTRICITY':
          data = await generateElectricityReport(finalFilters, undefined)
          break
        default:
          break
      }
      if (data) {
        const rows = data.rows || []
        const headers = data.headers || (rows.length > 0 ? Object.keys(rows[0]) : [])
        results[rt] = {
          title: reportTitles[rt] || rt,
          rows,
          headers,
          summary: data.summary || undefined,
        }
      }
    }

    // Transform flat results into reportsByProperty format
    const reportsByProperty: Record<string, any> = {
      'all-properties': {
        propertyId: 'all-properties',
        propertyName: 'All Properties',
        reports: results,
      },
    }

    // Fetch logo and theme color
    const logoUrl = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings/logo/public`)
      .then(res => res.ok ? res.json().then((d: any) => d.logoUrl) : null)
      .catch(() => null)
    
    const themeColor = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settings/theme/public`)
      .then(res => res.ok ? res.json().then((d: any) => d.themeColor || '#f97316') : '#f97316')
      .catch(() => '#f97316')

    const pdfBuffer = await renderToBuffer(
      <AllReportsPDF
        reportsByProperty={reportsByProperty}
        dateFrom={dateFrom}
        dateTo={dateTo}
        generatedAt={new Date().toISOString()}
        logoUrl={logoUrl}
        themeColor={themeColor}
      />
    )

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="reports-all.pdf"',
      },
    })
  } catch (error: any) {
    console.error('Failed to export combined reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export combined reports' },
      { status: 500 }
    )
  }
}

