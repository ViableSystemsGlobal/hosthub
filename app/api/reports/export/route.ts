import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
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
import { exportToExcel, exportToCSV } from '@/lib/reports/excel-export'
import { ReportType } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow owners to export reports for their properties
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { type, filters, fields, grouping, format = 'EXCEL', filename } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      )
    }

    // For owners, filter to their properties only
    let finalFilters = filters || {}
    if (user.role === 'OWNER' && user.ownerId) {
      const ownerProperties = await prisma.property.findMany({
        where: { ownerId: user.ownerId },
        select: { id: true },
      })
      const propertyIds = ownerProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json({ error: 'No properties found' }, { status: 400 })
      }
      // Merge with existing filters
      finalFilters = {
        ...finalFilters,
        propertyIds: finalFilters.propertyIds 
          ? finalFilters.propertyIds.filter((id: string) => propertyIds.includes(id))
          : propertyIds,
        ownerIds: [user.ownerId],
      }
    }

    // Generate report data
    let reportData

    switch (type) {
      case 'BOOKINGS':
        reportData = await generateBookingsReport(finalFilters, fields)
        break
      case 'REVENUE':
        reportData = await generateRevenueReport(finalFilters, grouping || 'month')
        break
      case 'EXPENSES':
        reportData = await generateExpensesReport(finalFilters, fields)
        break
      case 'OCCUPANCY':
        reportData = await generateOccupancyReport(finalFilters, grouping || 'month')
        break
      case 'INVENTORY':
        reportData = await generateInventoryReport(finalFilters, fields)
        break
      case 'CLEANING_TASKS':
        reportData = await generateCleaningTasksReport(finalFilters, fields)
        break
      case 'CHECK_IN':
        reportData = await generateCheckInReport(finalFilters, fields)
        break
      case 'ELECTRICITY':
        reportData = await generateElectricityReport(finalFilters, fields)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    // Export based on format
    if (format === 'CSV') {
      const csv = exportToCSV(reportData)
      const csvBuffer = Buffer.from(csv, 'utf-8')
      
      return new NextResponse(csvBuffer as any, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename || 'report'}.csv"`,
        },
      })
    } else {
      // Excel format
      const excelBuffer = exportToExcel(reportData, filename || 'report')
      
      return new NextResponse(excelBuffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename || 'report'}.xlsx"`,
        },
      })
    }
  } catch (error: any) {
    console.error('Failed to export report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export report' },
      { status: 500 }
    )
  }
}
