import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { AllReportsPDF } from '@/components/pdf/all-reports-pdf'
import { ReportPDF } from '@/components/pdf/report-pdf'
import { format } from 'date-fns'

// Fetch logo from settings (public endpoint accessible to all users)
async function getLogoUrl(): Promise<string | null> {
  try {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/settings/logo/public`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      if (data.logoUrl) {
        // Convert relative URL to absolute URL for PDF rendering
        if (data.logoUrl.startsWith('/')) {
          return `${baseUrl}${data.logoUrl}`
        }
        return data.logoUrl
      }
    }
  } catch (error) {
    console.error('Failed to fetch logo:', error)
  }
  return null
}

// Fetch theme color from settings (public endpoint accessible to all users)
async function getThemeColor(): Promise<string> {
  try {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/settings/theme/public`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      const themeColor = data.themeColor || '#f97316'
      console.log('Fetched theme color:', themeColor) // Debug log
      return themeColor
    } else {
      console.warn('Failed to fetch theme color, status:', res.status)
    }
  } catch (error) {
    console.error('Failed to fetch theme color:', error)
  }
  console.warn('Using default theme color: #f97316')
  return '#f97316' // Default orange
}

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
 * Calculate summary for a property's rows
 */
function calculatePropertySummary(
  reportType: string, 
  rows: any[], 
  headers: string[]
): Record<string, any> {
  if (!rows || rows.length === 0) return {}
  
  switch (reportType) {
    case 'bookings': {
      // Find relevant columns
      const payoutHeader = headers.find(h => 
        h.toLowerCase().includes('payout') && !h.toLowerCase().includes('base')
      ) || 'Payout'
      const nightsHeader = headers.find(h => h.toLowerCase().includes('night')) || 'Nights'
      const currencyHeader = headers.find(h => h.toLowerCase().includes('currency')) || 'Currency'
      
      // Group revenue by currency
      const revenueByCurrency: Record<string, number> = {}
      let totalNights = 0
      
      rows.forEach(row => {
        // Get values from row (could be object or array)
        const payoutStr = String(row[payoutHeader] || row['Payout'] || '0')
        const currency = String(row[currencyHeader] || row['Currency'] || 'GHS')
        const nights = parseInt(String(row[nightsHeader] || row['Nights'] || '0'), 10) || 0
        
        // Parse the payout value (remove currency symbol and commas)
        const payoutValue = parseFloat(payoutStr.replace(/[^\d.-]/g, '')) || 0
        
        if (!revenueByCurrency[currency]) {
          revenueByCurrency[currency] = 0
        }
        revenueByCurrency[currency] += payoutValue
        totalNights += nights
      })
      
      // Format revenue string
      const revenueStr = Object.entries(revenueByCurrency)
        .map(([curr, amount]) => {
          const symbol = curr === 'USD' ? '$' : curr === 'GHS' ? 'GHS ' : `${curr} `
          return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        })
        .join(' + ')
      
      return {
        'Total Bookings': rows.length,
        'Total Nights': totalNights,
        'Total Revenue': revenueStr || '$0.00',
      }
    }
    
    case 'expenses': {
      const amountHeader = headers.find(h => h.toLowerCase().includes('amount')) || 'Amount'
      
      let totalExpenses = 0
      rows.forEach(row => {
        const amountStr = String(row[amountHeader] || row['Amount'] || '0')
        totalExpenses += parseFloat(amountStr.replace(/[^\d.-]/g, '')) || 0
      })
      
      return {
        'Total Expenses': rows.length,
        'Total Amount': `GHS ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }
    }
    
    case 'cleaning-tasks': {
      const statusHeader = headers.find(h => h.toLowerCase().includes('status')) || 'Status'
      
      const completed = rows.filter(row => {
        const status = String(row[statusHeader] || row['Status'] || '').toLowerCase()
        return status.includes('completed') || status.includes('done')
      }).length
      
      return {
        'Total Tasks': rows.length,
        'Completed': completed,
        'Pending': rows.length - completed,
      }
    }
    
    case 'check-in': {
      const checkedInHeader = headers.find(h => 
        h.toLowerCase().includes('checked') && h.toLowerCase().includes('in')
      )
      
      const checkedIn = checkedInHeader ? rows.filter(row => {
        const value = row[checkedInHeader]
        return value && value !== '-' && value !== ''
      }).length : 0
      
      return {
        'Total Bookings': rows.length,
        'Checked In': checkedIn,
        'Pending Check-In': rows.length - checkedIn,
      }
    }
    
    case 'electricity': {
      const balanceHeader = headers.find(h => h.toLowerCase().includes('balance')) || 'Balance'
      
      let totalBalance = 0
      let count = 0
      rows.forEach(row => {
        const balanceStr = String(row[balanceHeader] || row['Balance'] || '0')
        const balance = parseFloat(balanceStr.replace(/[^\d.-]/g, '')) || 0
        if (balance > 0) {
          totalBalance += balance
          count++
        }
      })
      
      return {
        'Total Readings': rows.length,
        'Average Balance': count > 0 ? `GHS ${(totalBalance / count).toFixed(2)}` : 'N/A',
      }
    }
    
    case 'inventory': {
      const typeHeader = headers.find(h => h.toLowerCase().includes('type')) || 'Type'
      const statusHeader = headers.find(h => h.toLowerCase().includes('status')) || 'Status'
      
      const consumable = rows.filter(row => {
        const type = String(row[typeHeader] || row['Type'] || '').toLowerCase()
        return type.includes('consumable')
      }).length
      
      const lowStock = rows.filter(row => {
        const status = String(row[statusHeader] || row['Status'] || '').toLowerCase()
        return status.includes('low')
      }).length
      
      return {
        'Total Items': rows.length,
        'Consumables': consumable,
        'Stationary': rows.length - consumable,
        'Low Stock': lowStock,
      }
    }
    
    default:
      return {
        'Total Records': rows.length,
      }
  }
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
    // Fetch all properties with images (we'll match by name/nickname)
    const res = await fetch('/api/reports/properties', {
      credentials: 'include',
    })
    if (!res.ok) {
      throw new Error('Failed to fetch properties')
    }
    const properties = await res.json()

    // Create property maps for quick lookup
    const propertyMapById = new Map(properties.map(p => [p.id, p]))
    const propertyMapByName = new Map<string, typeof properties[0]>()
    properties.forEach(p => {
      propertyMapByName.set(p.name.toLowerCase(), p)
      if (p.nickname) {
        propertyMapByName.set(p.nickname.toLowerCase(), p)
      }
    })

    // Transform data and group by property
    const reportsByProperty: Record<string, {
      propertyId: string
      propertyName: string
      propertyImage?: string
      reports: Record<string, { title: string; rows: any[]; headers?: string[]; summary?: Record<string, any> }>
    }> = {}

    // Group reports by property
    for (const [key, data] of Object.entries(allReportsData)) {
      if (data && data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
        // Find the "Property" column index
        const propertyHeaderIndex = data.headers?.findIndex(h => 
          h.toLowerCase() === 'property' || h.toLowerCase().includes('property')
        ) ?? -1

        if (propertyHeaderIndex === -1) {
          // No property column, skip grouping or use "All Properties"
          const allKey = 'all'
          if (!reportsByProperty[allKey]) {
            reportsByProperty[allKey] = {
              propertyId: allKey,
              propertyName: 'All Properties',
              reports: {},
            }
          }
          reportsByProperty[allKey].reports[key] = {
            title: reportLabels[key] || key,
            rows: data.rows,
            headers: data.headers,
            summary: data.summary,
          }
          continue
        }

        // Convert array rows to objects and group by property
        const rowsByProperty: Record<string, any[]> = {}
        
        data.rows.forEach((row) => {
          // Get property name from the row
          const propertyName = Array.isArray(row) 
            ? row[propertyHeaderIndex]?.toString() || 'Unknown'
            : row.property || row.Property?.name || 'Unknown'
          
          // Find property by name
          const propNameLower = propertyName.toLowerCase()
          const prop = propertyMapByName.get(propNameLower) || 
                      properties.find(p => 
                        p.name.toLowerCase() === propNameLower || 
                        (p.nickname && p.nickname.toLowerCase() === propNameLower)
                      )
          
          const propKey = prop?.id || propertyName
          
          if (!rowsByProperty[propKey]) {
            rowsByProperty[propKey] = []
          }
          
          // Convert array row to object if needed
          if (Array.isArray(row) && data.headers) {
            const obj: any = {}
            data.headers.forEach((header, index) => {
              obj[header] = row[index]
            })
            rowsByProperty[propKey].push(obj)
          } else {
            rowsByProperty[propKey].push(row)
          }
        })
        
        // Add to reportsByProperty
        for (const [propKey, propRows] of Object.entries(rowsByProperty)) {
          // Find property info
          const prop = propertyMapById.get(propKey) || 
                      properties.find(p => p.name === propKey || p.nickname === propKey)
          
          const propertyId = prop?.id || propKey
          const propertyName = prop?.nickname || prop?.name || propKey
          const propertyImage = (prop?.photos && Array.isArray(prop.photos) && prop.photos.length > 0)
            ? prop.photos[0]
            : undefined
          
          if (!reportsByProperty[propertyId]) {
            reportsByProperty[propertyId] = {
              propertyId,
              propertyName,
              propertyImage,
              reports: {},
            }
          }
          
          // Calculate per-property summary
          const propertySummary = calculatePropertySummary(key, propRows, data.headers || [])
          
          reportsByProperty[propertyId].reports[key] = {
            title: reportLabels[key] || key,
            rows: propRows,
            headers: data.headers,
            summary: propertySummary,
          }
        }
      }
    }

    if (Object.keys(reportsByProperty).length === 0) {
      throw new Error('No report data available to export')
    }

    const dateLabel = `${format(new Date(dateFrom), 'MMM d, yyyy')} - ${format(new Date(dateTo), 'MMM d, yyyy')}`
    const generatedAt = format(new Date(), 'MMM d, yyyy h:mm a')
    const logoUrl = await getLogoUrl()
    const themeColor = await getThemeColor()
    
    console.log('PDF Export - Using theme color:', themeColor) // Debug log

    // Fetch expenses with receipts for the period
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let receipts: Array<{
      id: string
      propertyName: string
      date: string
      description: string
      amount: number
      currency: string
      category: string
      receiptUrl: string
    }> = []
    
    try {
      console.log('Fetching receipts for period:', dateFrom, 'to', dateTo)
      const receiptsRes = await fetch(
        `${baseUrl}/api/expenses?startDate=${dateFrom}&endDate=${dateTo}&withReceipts=true`,
        { credentials: 'include', cache: 'no-store' }
      )
      console.log('Receipts API response status:', receiptsRes.status)
      
      if (receiptsRes.ok) {
        const expensesData = await receiptsRes.json()
        console.log('Total expenses fetched:', expensesData.length)
        console.log('Expenses with attachmentUrl:', expensesData.filter((exp: any) => exp.attachmentUrl).length)
        
        receipts = expensesData
          .filter((exp: any) => exp.attachmentUrl)
          .map((exp: any) => {
            const receiptUrl = exp.attachmentUrl.startsWith('http') 
              ? exp.attachmentUrl 
              : exp.attachmentUrl.startsWith('/')
              ? `${baseUrl}${exp.attachmentUrl}`
              : `${baseUrl}/${exp.attachmentUrl}`
            
            return {
              id: exp.id,
              propertyName: exp.Property?.nickname || exp.Property?.name || 'Unknown',
              date: exp.date,
              description: exp.description,
              amount: exp.amount,
              currency: exp.currency,
              category: exp.category,
              receiptUrl,
            }
          })
        console.log('Processed receipts:', receipts.length)
      } else {
        const errorText = await receiptsRes.text()
        console.error('Failed to fetch receipts, status:', receiptsRes.status, 'error:', errorText)
      }
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
    }
    
    console.log('Final receipts count for PDF:', receipts.length)

    // Generate PDF blob
    const blob = await pdf(
      <AllReportsPDF
        reportsByProperty={reportsByProperty}
        dateFrom={dateFrom}
        dateTo={dateTo}
        generatedAt={generatedAt}
        logoUrl={logoUrl}
        themeColor={themeColor}
        receipts={receipts}
      />
    ).toBlob()

    // Create download link
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

    const logoUrl = await getLogoUrl()
    const themeColor = await getThemeColor()
    const reportTypeLabel = reportLabels[reportType] || reportType
    
    console.log('PDF Export - Using theme color:', themeColor) // Debug log
    
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
        logoUrl={logoUrl}
        themeColor={themeColor}
      />
    ).toBlob()

    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
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

