import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/currency'
import { format } from 'date-fns'

// Base styles
const baseStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
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
    fontWeight: 'bold',
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 10,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1pt solid #e0e0e0',
    padding: 6,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    overflow: 'hidden',
  },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  summaryRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 10,
  },
})

// Function to create dynamic styles with theme color
const createStyles = (themeColor: string = '#f97316') => StyleSheet.create({
  ...baseStyles,
  total: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingTop: 8,
    borderTop: `2pt solid ${themeColor}`,
  },
})

interface ReportPDFProps {
  reportType: string
  data: any[]
  startDate?: string | null
  endDate?: string | null
  filters?: {
    property?: string
    owner?: string
  }
  logoUrl?: string | null
  themeColor?: string
}

export function ReportPDF({ reportType, data, startDate, endDate, filters, logoUrl, themeColor = '#f97316' }: ReportPDFProps) {
  // Ensure themeColor is valid hex color
  const validThemeColor = /^#[0-9A-Fa-f]{6}$/.test(themeColor) ? themeColor : '#f97316'
  console.log('ReportPDF - Received themeColor:', themeColor, 'Using:', validThemeColor)
  
  const styles = createStyles(validThemeColor)
  const getTitle = () => {
    switch (reportType) {
      case 'bookings':
        return 'Bookings Report'
      case 'expenses':
        return 'Expenses Report'
      case 'revenue':
        return 'Revenue Summary Report'
      case 'occupancy':
        return 'Occupancy Report'
      default:
        return 'Report'
    }
  }

  const getDateRange = () => {
    if (startDate && endDate) {
      return `${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`
    }
    return 'All Time'
  }

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" orientation="landscape" style={styles.coverPage}>
        {logoUrl && (
          <Image src={logoUrl} style={styles.logo} />
        )}
        <Text style={styles.coverTitle}>{getTitle()}</Text>
        <Text style={styles.coverSubtitle}>Period: {getDateRange()}</Text>
        {filters?.property && <Text style={styles.coverSubtitle}>Property: {filters.property}</Text>}
        {filters?.owner && <Text style={styles.coverSubtitle}>Owner: {filters.owner}</Text>}
      </Page>
      
      {/* Report Content */}
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{getTitle()} ({data.length} {data.length === 1 ? 'item' : 'items'})</Text>
          <Text style={styles.subtitle}>Period: {getDateRange()}</Text>
          {filters?.property && <Text style={styles.subtitle}>Property: {filters.property}</Text>}
          {filters?.owner && <Text style={styles.subtitle}>Owner: {filters.owner}</Text>}
        </View>

        {reportType === 'bookings' && (
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]} fixed>
                <Text style={[styles.tableCell, { flex: 2 }]} wrap>Property</Text>
                <Text style={styles.tableCell} wrap>Guest</Text>
                <Text style={styles.tableCell} wrap>Check-in</Text>
                <Text style={styles.tableCell} wrap>Check-out</Text>
                <Text style={styles.tableCell} wrap>Nights</Text>
                <Text style={styles.tableCell} wrap>Amount</Text>
                <Text style={styles.tableCell} wrap>Status</Text>
              </View>
              {data.map((booking: any, index: number) => (
                <View key={index} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, { flex: 2 }]} wrap>{booking.propertyName || booking.property || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{booking.guestName || booking.guest || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{booking.checkInDate ? format(new Date(booking.checkInDate), 'MMM d') : 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{booking.checkOutDate ? format(new Date(booking.checkOutDate), 'MMM d') : 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{booking.nights || '0'}</Text>
                  <Text style={styles.tableCell} wrap>
                    {formatCurrency(booking.totalPayout || booking.payout || booking.amount || 0, booking.currency || 'GHS')}
                  </Text>
                  <Text style={styles.tableCell} wrap>{booking.status || 'N/A'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {reportType === 'expenses' && (
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]} fixed>
                <Text style={[styles.tableCell, { flex: 2 }]} wrap>Property</Text>
                <Text style={styles.tableCell} wrap>Date</Text>
                <Text style={styles.tableCell} wrap>Category</Text>
                <Text style={styles.tableCell} wrap>Description</Text>
                <Text style={styles.tableCell} wrap>Amount</Text>
              </View>
              {data.map((expense: any, index: number) => (
                <View key={index} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, { flex: 2 }]} wrap>{expense.propertyName || expense.property || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{expense.date ? format(new Date(expense.date), 'MMM d') : 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{expense.category || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{expense.description || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>
                    {formatCurrency(expense.amount || 0, expense.currency || 'GHS')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {reportType === 'revenue' && (
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]} fixed>
                <Text style={[styles.tableCell, { flex: 3 }]} wrap>Property</Text>
                <Text style={styles.tableCell} wrap>Bookings</Text>
                <Text style={styles.tableCell} wrap>Revenue</Text>
                <Text style={styles.tableCell} wrap>Nights</Text>
              </View>
              {data.map((item: any, index: number) => (
                <View key={index} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, { flex: 3 }]} wrap>{item.property || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{item.bookings || '0'}</Text>
                  <Text style={styles.tableCell} wrap>
                    {formatCurrency(item.revenue || 0, item.currency || 'GHS')}
                  </Text>
                  <Text style={styles.tableCell} wrap>{item.nights || '0'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {reportType === 'occupancy' && (
          <View style={styles.section}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]} fixed>
                <Text style={[styles.tableCell, { flex: 3 }]} wrap>Property</Text>
                <Text style={styles.tableCell} wrap>Bookings</Text>
                <Text style={styles.tableCell} wrap>Nights</Text>
                <Text style={styles.tableCell} wrap>Period Days</Text>
                <Text style={styles.tableCell} wrap>Occupancy %</Text>
              </View>
              {data.map((item: any, index: number) => (
                <View key={index} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, { flex: 3 }]} wrap>{item.property || 'N/A'}</Text>
                  <Text style={styles.tableCell} wrap>{item.bookings || '0'}</Text>
                  <Text style={styles.tableCell} wrap>{item.nights || '0'}</Text>
                  <Text style={styles.tableCell} wrap>{item.periodDays || '0'}</Text>
                  <Text style={styles.tableCell} wrap>{item.occupancy || '0'}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  )
}

