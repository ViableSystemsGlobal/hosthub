/**
 * Excel Export Utility
 * Converts report data to Excel format
 */

// @ts-ignore - xlsx types
import * as XLSX from 'xlsx'
import { ReportData } from './generator'

export function exportToExcel(data: ReportData, filename: string = 'report'): Buffer {
  const workbook = XLSX.utils.book_new()

  // Create main data sheet
  const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows])

  // Set column widths
  const colWidths = data.headers.map((_, index) => {
    const maxLength = Math.max(
      data.headers[index].length,
      ...data.rows.map((row) => (row[index]?.toString() || '').length)
    )
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }
  })
  worksheet['!cols'] = colWidths

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')

  // Add summary sheet if available
  if (data.summary) {
    const summaryData = Object.entries(data.summary).map(([key, value]) => [
      key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
      typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(2)) : value,
    ])
    const summarySheet = XLSX.utils.aoa_to_sheet([['Metric', 'Value'], ...summaryData])
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
  }

  // Convert to buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return excelBuffer
}

export function exportToCSV(data: ReportData): string {
  const rows = [data.headers, ...data.rows]
  return rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

