import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { AllReportsPDF } from '@/components/pdf/all-reports-pdf'
import { ReportPDF } from '@/components/pdf/report-pdf'
import { format } from 'date-fns'

type ReportData = {
  headers: string[]
  rows: any[]
  summary?: Record<string, any>
}

type AllReportsData = Record<string, ReportData>

const reportLabels: Record<string, string> = {
  bookings: 'Bookings',
  expenses: 'Expenses',
  revenue: 'Revenue',
  occupancy: 'Occupancy',
  inventory: 'Inventory',
  'cleaning-tasks': 'Cleaning Tasks',
  'check-in': 'Check-In',
  electricity: 'Electricity',
}

/**
 * Generate and download a PDF for "All" reports
 */
export async function exportAllReportsToPDF(
  allReportsData: AllReportsData,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  try {
    // Transform data to match AllReportsPDF component format
    const reports: Record<string, { title: string; rows: any[]; headers?: string[]; summary?: Record<string, any> }> = {}
    
    for (const [key, data] of Object.entries(allReportsData)) {
      if (data && data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
        reports[key] = {
          title: reportLabels[key] || key,
          rows: data.rows,
          headers: data.headers,
          summary: data.summary,
        }
      }
    }

    if (Object.keys(reports).length === 0) {
      throw new Error('No report data available to export')
    }

    const dateLabel = `${format(new Date(dateFrom), 'MMM d, yyyy')} - ${format(new Date(dateTo), 'MMM d, yyyy')}`
    const generatedAt = format(new Date(), 'MMM d, yyyy h:mm a')

    // Generate PDF buffer
    const pdfBuffer = await renderToBuffer(
      React.createElement(AllReportsPDF, {
        reportsByProperty: {},
        dateFrom,
        dateTo,
        generatedAt,
        logoUrl: undefined,
        themeColor: '#f97316',
        receipts: [],
      }) as any
    )

    // Create download link
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `All-Reports-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('PDF export error:', error)
    throw error
  }
}

/**
 * Generate and download a PDF for a single report
 */
export async function exportReportToPDF(
  reportType: string,
  reportData: ReportData,
  dateFrom: string,
  dateTo: string,
  propertyName?: string,
  ownerName?: string
): Promise<void> {
  try {
    if (!reportData || !reportData.rows || reportData.rows.length === 0) {
      throw new Error('No report data available to export')
    }

    // Transform rows to match ReportPDF component format
    const rows = reportData.rows.map((row) => {
      // Convert array row to object if needed
      if (Array.isArray(row)) {
        const obj: any = {}
        reportData.headers.forEach((header, index) => {
          obj[header] = row[index]
        })
        return obj
      }
      return row
    })

    // Generate PDF blob
    const blob = await pdf(
      <ReportPDF
        reportType={reportType}
        data={rows}
        startDate={dateFrom}
        endDate={dateTo}
        filters={{
          property: propertyName,
          owner: ownerName,
        }}
      />
    ).toBlob()

    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const reportTypeLabel = reportLabels[reportType] || reportType
    link.download = `${reportTypeLabel}-Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('PDF export error:', error)
    throw error
  }
}

