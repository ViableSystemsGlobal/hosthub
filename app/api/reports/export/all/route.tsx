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
  generateIssuesReport,
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
  'ISSUES',
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
  ISSUES: 'Issues',
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
        case 'ISSUES':
          data = await generateIssuesReport(finalFilters, undefined)
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

    // Get all properties for grouping
    const propertyIds = finalFilters.propertyIds || []
    const properties = propertyIds.length > 0
      ? await prisma.property.findMany({
          where: { id: { in: propertyIds } },
          select: { id: true, name: true, nickname: true, photos: true },
        })
      : await prisma.property.findMany({
          where: finalFilters.ownerIds ? { ownerId: { in: finalFilters.ownerIds } } : {},
          select: { id: true, name: true, nickname: true, photos: true },
        })

    // Transform results into reportsByProperty format
    // First, create "All Properties" entry with all reports
    const reportsByProperty: Record<string, any> = {
      'all-properties': {
        propertyId: 'all-properties',
        propertyName: 'All Properties',
        reports: results,
      },
    }

    // Then, create per-property entries with filtered reports
    for (const property of properties) {
      const propertyReports: Record<string, any> = {}
      
      // Filter each report type by property
      for (const [reportType, reportData] of Object.entries(results)) {
        if (reportData.rows && Array.isArray(reportData.rows)) {
          // Find property column index
          const propertyHeaderIndex = reportData.headers?.findIndex((h: string) => 
            h.toLowerCase().includes('property')
          ) ?? -1
          
          if (propertyHeaderIndex >= 0) {
            // Filter rows for this property
            const propertyRows = reportData.rows.filter((row: any[]) => {
              const propertyValue = row[propertyHeaderIndex] || ''
              const propertyName = property.nickname || property.name
              return propertyValue.includes(propertyName) || 
                     propertyValue === property.id ||
                     propertyValue === property.name
            })
            
            if (propertyRows.length > 0) {
              propertyReports[reportType] = {
                ...reportData,
                rows: propertyRows,
              }
            }
          } else {
            // If no property column, include all rows (for reports that don't have property breakdown)
            propertyReports[reportType] = reportData
          }
        }
      }
      
      if (Object.keys(propertyReports).length > 0) {
        reportsByProperty[property.id] = {
          propertyId: property.id,
          propertyName: property.nickname || property.name,
          propertyImage: property.photos && property.photos.length > 0 ? property.photos[0] : undefined,
          reports: propertyReports,
        }
      }
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
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
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

