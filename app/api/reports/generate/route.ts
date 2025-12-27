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
  generateIssuesReport,
} from '@/lib/reports/generator'
import { ReportType } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow owners to generate reports for their properties
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OWNER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { type, filters, fields, grouping, format = 'EXCEL' } = body

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
        return NextResponse.json({
          success: true,
          data: { rows: [], summary: {} },
          format,
        })
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
      case 'ISSUES':
        reportData = await generateIssuesReport(finalFilters, fields)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: reportData,
      format,
    })
  } catch (error: any) {
    console.error('Failed to generate report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}

