import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { format } from 'date-fns'

type ReportSection = {
  title: string
  rows: any[]
  headers?: string[]
  summary?: Record<string, any>
}

type PropertyReports = {
  propertyId: string
  propertyName: string
  propertyImage?: string
  reports: Record<string, ReportSection>
}

type Receipt = {
  id: string
  propertyName: string
  date: string
  description: string
  amount: number
  currency: string
  category: string
  receiptUrl: string
}

type StatementPreview = {
  owner: {
    id: string
    name: string
    email: string
  }
  periodStart: string
  periodEnd: string
  displayCurrency: string
  grossRevenue: number
  companyRevenue: number
  ownerRevenue: number
  commissionAmount: number
  companyCommission: number
  ownerCommission: number
  totalExpenses: number
  companyPaidExpenses: number
  ownerPaidExpenses: number
  netToOwner: number
  openingBalance: number
  closingBalance: number
  statementLines: Array<{
    type: string
    description: string
    amountInDisplayCurrency: number
  }>
  bookingsCount: number
  expensesCount: number
}

interface AllReportsPDFProps {
  reportsByProperty: Record<string, PropertyReports>
  dateFrom?: string
  dateTo?: string
  generatedAt?: string
  logoUrl?: string | null
  themeColor?: string
  receipts?: Receipt[]
  statements?: StatementPreview[]
}

// Base styles (colors will be overridden dynamically)
const baseStyles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  coverPage: {
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  logo: {
    width: 200,
    height: 'auto',
    marginBottom: 40,
    objectFit: 'contain',
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    marginBottom: 12,
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  propertySection: {
    marginBottom: 30,
    pageBreak: 'auto',
  },
})

// Function to create dynamic styles with theme color
const createStyles = (themeColor: string = '#f97316') => StyleSheet.create({
  ...baseStyles,
  propertyHeader: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: `2 solid ${themeColor}`,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: themeColor,
    marginBottom: 8,
  },
  propertyImage: {
    width: 200,
    height: 150,
    objectFit: 'cover',
    marginBottom: 10,
    borderRadius: 4,
  },
  section: {
    marginBottom: 18,
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },
  summary: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9fafb',
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    flexDirection: 'column',
  },
  summaryText: {
    fontSize: 10,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  table: {
    border: '1 solid #e5e7eb',
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    minHeight: 20,
  },
  tableHeaderCellWrapper: {
    borderRight: '1 solid #e5e7eb',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontWeight: 700,
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderTop: '1 solid #e5e7eb',
    minHeight: 18,
  },
  tableCellWrapper: {
    borderRight: '1 solid #e5e7eb',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 8,
  },
  receiptsPage: {
    padding: 20,
  },
  receiptsTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 15,
    color: themeColor,
  },
  receiptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  receiptCard: {
    width: '48%',
    marginBottom: 15,
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 8,
  },
  receiptImage: {
    width: '100%',
    height: 150,
    objectFit: 'contain',
    marginBottom: 6,
    backgroundColor: '#f9fafb',
  },
  receiptInfo: {
    fontSize: 8,
  },
  receiptProperty: {
    fontWeight: 700,
    marginBottom: 2,
    color: themeColor,
  },
  receiptDescription: {
    marginBottom: 2,
  },
  receiptAmount: {
    fontWeight: 700,
  },
  logoHeader: {
    width: 150,
    height: 'auto',
    marginBottom: 20,
    objectFit: 'contain',
  },
  // Statement styles
  statementPage: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  statementHeader: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: `2 solid ${themeColor}`,
  },
  statementTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: themeColor,
    marginBottom: 5,
  },
  statementOwner: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 3,
  },
  statementPeriod: {
    fontSize: 10,
    color: '#6b7280',
  },
  statementSection: {
    marginBottom: 15,
  },
  statementSectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: '#374151',
  },
  statementTable: {
    border: '1 solid #e5e7eb',
    borderRadius: 2,
  },
  statementTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    minHeight: 25,
  },
  statementTableHeaderCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: 700,
    fontSize: 9,
    borderRight: '1 solid #e5e7eb',
  },
  statementTableRow: {
    flexDirection: 'row',
    borderTop: '1 solid #e5e7eb',
    minHeight: 22,
  },
  statementTableCell: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 9,
    borderRight: '1 solid #e5e7eb',
  },
  statementSummary: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f9fafb',
    border: '1 solid #e5e7eb',
    borderRadius: 4,
  },
  statementSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statementSummaryLabel: {
    fontSize: 10,
  },
  statementSummaryValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  statementTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: `2 solid ${themeColor}`,
  },
  statementTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  statementTotalValue: {
    fontSize: 12,
    fontWeight: 700,
    color: themeColor,
  },
  statementSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingLeft: 15,
  },
  statementSubLabel: {
    fontSize: 9,
    color: '#6b7280',
  },
  statementSubValue: {
    fontSize: 9,
    color: '#6b7280',
  },
})

const normalizeHeaders = (rows: any[], headers?: string[]) => {
  if (headers && headers.length) return headers
  if (!rows || rows.length === 0) return []
  return Object.keys(rows[0])
}

const formatValue = (val: any) => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toString() : val.toFixed(2)
  }
  if (val instanceof Date) return val.toISOString()
  return String(val)
}

// Calculate column widths based on content (landscape A4 = 842pt width)
const calculateColumnWidths = (headers: string[], rows: any[], pageWidth: number = 802): number[] => {
  const padding = 20 * 2 // left + right page padding
  const availableWidth = pageWidth - padding
  
  // Base widths for common column types (increased for landscape)
  const columnTypeWidths: Record<string, number> = {
    'check-in': 90,
    'check-out': 90,
    'checkin': 90,
    'checkout': 90,
    'date': 90,
    'dates': 90,
    'guest': 100,
    'property': 150,
    'owner': 100,
    'nights': 60,
    'night': 60,
    'payout': 100,
    'amount': 100,
    'currency': 60,
    'status': 80,
    'source': 70,
    'category': 90,
    'description': 130,
  }
  
  // Try to match headers to known types
  const widths = headers.map((header) => {
    const headerLower = header.toLowerCase()
    for (const [key, width] of Object.entries(columnTypeWidths)) {
      if (headerLower.includes(key)) {
        return width
      }
    }
    // Default width based on header length (more generous in landscape)
    return Math.max(70, Math.min(150, header.length * 8))
  })
  
  // Normalize widths to fit available space
  const totalWidth = widths.reduce((sum, w) => sum + w, 0)
  if (totalWidth <= availableWidth) {
    // If total fits, use as-is
    return widths
  }
  
  // Scale down if needed
  const scale = availableWidth / totalWidth
  return widths.map(w => Math.floor(w * scale))
}

export function AllReportsPDF({ reportsByProperty, dateFrom, dateTo, generatedAt, logoUrl, themeColor = '#f97316', receipts = [], statements = [] }: AllReportsPDFProps) {
  const dateLabel = [dateFrom, dateTo].filter(Boolean).join(' to ')
  const properties = Object.values(reportsByProperty || {})
  
  // Ensure themeColor is valid hex color
  const validThemeColor = /^#[0-9A-Fa-f]{6}$/.test(themeColor) ? themeColor : '#f97316'
  console.log('AllReportsPDF - Received themeColor:', themeColor, 'Using:', validThemeColor)
  console.log('AllReportsPDF - Receipts count:', receipts.length)
  console.log('AllReportsPDF - Receipts data:', receipts)
  
  const styles = createStyles(validThemeColor)
  
  // Format currency for display
  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'USD' ? '$' : currency === 'GHS' ? 'GHS ' : `${currency} `
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const propertyPages: React.ReactElement[] = properties
    .filter((propertyData) => {
      const reportSections = Object.entries(propertyData.reports || {})
        .filter(([, data]) => data && Array.isArray(data.rows) && data.rows.length > 0)
      return reportSections.length > 0
    })
    .map((propertyData, propIdx) => {
      const reportSections = Object.entries(propertyData.reports || {})
        .filter(([, data]) => data && Array.isArray(data.rows) && data.rows.length > 0)
        .map(([key, data]) => ({
          key,
          ...data,
          headers: normalizeHeaders(data.rows, data.headers),
        }))

      return (
        <Page key={propertyData.propertyId} size="A4" orientation="landscape" style={styles.page} wrap>
          {/* Property Header */}
          <View style={styles.propertyHeader}>
            <Text style={styles.propertyTitle}>{propertyData.propertyName}</Text>
            {propertyData.propertyImage && (
              <Image 
                src={propertyData.propertyImage.startsWith('http') 
                  ? propertyData.propertyImage 
                  : propertyData.propertyImage.startsWith('/')
                  ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${propertyData.propertyImage}`
                  : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${propertyData.propertyImage}`} 
                style={styles.propertyImage} 
              />
            )}
          </View>

          {/* All Report Types for This Property */}
          {reportSections.map((section, idx) => (
            <View key={section.key + idx} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>

              {section.summary && (
                <View style={styles.summary}>
                  {Object.entries(section.summary).map(([k, v], i) => (
                    <Text key={i} style={styles.summaryText}>
                      {k}: {formatValue(v)}
                    </Text>
                  ))}
                </View>
              )}

              {section.headers && section.headers.length > 0 && (() => {
                const columnWidths = calculateColumnWidths(section.headers, section.rows)
                return (
                  <View key={`table-${section.key}`} style={styles.table}>
                    <View style={styles.tableHeader}>
                      {section.headers.map((h, i) => (
                        <View 
                          key={h + i} 
                      style={[
                        styles.tableHeaderCellWrapper,
                        { width: columnWidths[i] },
                        i === section.headers!.length - 1 ? { borderRight: 0 } : {}
                      ]}
                        >
                          <Text style={styles.tableHeaderCell} wrap>
                            {h}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {section.rows.slice(0, 200).map((row, rIdx) => (
                      <View key={rIdx} style={styles.tableRow}>
                    {section.headers!.map((h, cIdx) => {
                      const value = Array.isArray(row) ? row[cIdx] : (row as any)[h]
                      return (
                        <View 
                          key={h + cIdx} 
                      style={[
                        styles.tableCellWrapper,
                        { width: columnWidths[cIdx] },
                        cIdx === section.headers!.length - 1 ? { borderRight: 0 } : {}
                      ]}
                        >
                          <Text style={styles.tableCell} wrap>
                            {formatValue(value)}
                          </Text>
                        </View>
                      )
                    })}
                      </View>
                    ))}
                  </View>
                  ) as React.ReactElement
              })()}
              {(!section.rows || section.rows.length === 0) && <Text>No data</Text>}
            </View>
          ))}
        </Page>
      )
    })

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" orientation="landscape" style={styles.coverPage}>
        {logoUrl && (
          <Image src={logoUrl} style={styles.logo} />
        )}
        <Text style={styles.coverTitle}>Combined Reports</Text>
        {dateLabel && <Text style={styles.coverSubtitle}>Date Range: {dateLabel}</Text>}
        {generatedAt && <Text style={styles.coverSubtitle}>Generated: {generatedAt}</Text>}
      </Page>
      
      {propertyPages}
      
      {/* Statements Section - After All Properties */}
      {statements && statements.length > 0 && statements.map((statement, stmtIdx) => (
        <Page key={`statement-${statement.owner.id}`} size="A4" style={styles.statementPage} wrap>
          <View style={styles.statementHeader}>
            {logoUrl && (
              <Image src={logoUrl} style={styles.logoHeader} />
            )}
            <Text style={styles.statementTitle}>Statement of Account</Text>
            <Text style={styles.statementOwner}>{statement.owner.name}</Text>
            <Text style={styles.statementPeriod}>
              Period: {format(new Date(statement.periodStart), 'MMM dd, yyyy')} to {format(new Date(statement.periodEnd), 'MMM dd, yyyy')}
            </Text>
          </View>

          {/* Transactions Table */}
          {statement.statementLines && statement.statementLines.length > 0 && (
            <View style={styles.statementSection}>
              <Text style={styles.statementSectionTitle}>Transactions</Text>
              <View style={styles.statementTable}>
                <View style={styles.statementTableHeader}>
                  <View style={[styles.statementTableHeaderCell, { flex: 3 }]}>
                    <Text>Description</Text>
                  </View>
                  <View style={[styles.statementTableHeaderCell, { flex: 1, borderRight: 0 }]}>
                    <Text>Amount</Text>
                  </View>
                </View>
                {statement.statementLines.slice(0, 50).map((line, lineIdx) => (
                  <View key={lineIdx} style={styles.statementTableRow}>
                    <View style={[styles.statementTableCell, { flex: 3 }]}>
                      <Text>{line.description}</Text>
                    </View>
                    <View style={[styles.statementTableCell, { flex: 1, borderRight: 0 }]}>
                      <Text>{formatCurrency(line.amountInDisplayCurrency, statement.displayCurrency)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Summary */}
          <View style={styles.statementSummary}>
            <View style={styles.statementSummaryRow}>
              <Text style={styles.statementSummaryLabel}>Revenue (Total):</Text>
              <Text style={styles.statementSummaryValue}>{formatCurrency(statement.grossRevenue, statement.displayCurrency)}</Text>
            </View>
            {(statement.companyRevenue > 0 || statement.ownerRevenue > 0) && (
              <>
                <View style={styles.statementSubRow}>
                  <Text style={styles.statementSubLabel}>↳ Received by Company:</Text>
                  <Text style={styles.statementSubValue}>{formatCurrency(statement.companyRevenue, statement.displayCurrency)}</Text>
                </View>
                <View style={styles.statementSubRow}>
                  <Text style={styles.statementSubLabel}>↳ Received by Owner:</Text>
                  <Text style={styles.statementSubValue}>{formatCurrency(statement.ownerRevenue, statement.displayCurrency)}</Text>
                </View>
              </>
            )}
            <View style={styles.statementSummaryRow}>
              <Text style={styles.statementSummaryLabel}>Commission (Total):</Text>
              <Text style={styles.statementSummaryValue}>{formatCurrency(statement.commissionAmount, statement.displayCurrency)}</Text>
            </View>
            <View style={styles.statementSummaryRow}>
              <Text style={styles.statementSummaryLabel}>Gross (After Commission):</Text>
              <Text style={styles.statementSummaryValue}>{formatCurrency(statement.grossRevenue - statement.commissionAmount, statement.displayCurrency)}</Text>
            </View>
            <View style={styles.statementSummaryRow}>
              <Text style={styles.statementSummaryLabel}>Total Expenses:</Text>
              <Text style={styles.statementSummaryValue}>{formatCurrency(statement.totalExpenses, statement.displayCurrency)}</Text>
            </View>
            <View style={[styles.statementSummaryRow, styles.statementTotal]}>
              <Text style={styles.statementTotalLabel}>Net to Owner:</Text>
              <Text style={styles.statementTotalValue}>{formatCurrency(statement.netToOwner, statement.displayCurrency)}</Text>
            </View>
            <View style={styles.statementSummaryRow}>
              <Text style={styles.statementSummaryLabel}>Opening Balance:</Text>
              <Text style={styles.statementSummaryValue}>{formatCurrency(statement.openingBalance, statement.displayCurrency)}</Text>
            </View>
            <View style={[styles.statementSummaryRow, styles.statementTotal]}>
              <Text style={styles.statementTotalLabel}>Closing Balance:</Text>
              <Text style={styles.statementTotalValue}>{formatCurrency(statement.closingBalance, statement.displayCurrency)}</Text>
            </View>
          </View>
        </Page>
      ))}
      
      {/* Receipts Page - After All Properties */}
      {receipts && receipts.length > 0 ? (
        <Page size="A4" orientation="landscape" style={styles.page} wrap>
          <View style={styles.header}>
            {logoUrl && (
              <Image src={logoUrl} style={styles.logoHeader} />
            )}
            <Text style={styles.receiptsTitle}>Receipts</Text>
            {dateLabel && <Text style={styles.subtitle}>Date Range: {dateLabel}</Text>}
            <Text style={styles.subtitle}>Total Receipts: {receipts.length}</Text>
          </View>
          
          <View style={styles.receiptsGrid}>
            {receipts.map((receipt, idx) => {
              try {
                return (
                  <View key={receipt.id || idx} style={styles.receiptCard} wrap={false}>
                    <Image 
                      src={receipt.receiptUrl} 
                      style={styles.receiptImage}
                      cache={false}
                    />
                    <View style={styles.receiptInfo}>
                      <Text style={styles.receiptProperty}>{receipt.propertyName || 'Unknown Property'}</Text>
                      <Text style={styles.receiptDescription}>{receipt.description || 'No description'}</Text>
                      <Text style={styles.receiptInfo}>
                        {receipt.date ? format(new Date(receipt.date), 'MMM dd, yyyy') : 'No date'} • {receipt.category || 'N/A'}
                      </Text>
                      <Text style={styles.receiptAmount}>
                        {formatCurrency(receipt.amount || 0, receipt.currency || 'GHS')}
                      </Text>
                    </View>
                  </View>
                )
              } catch (error) {
                console.error('Error rendering receipt:', receipt, error)
                return null
              }
            })}
          </View>
        </Page>
      ) : null}
    </Document>
  )
}

