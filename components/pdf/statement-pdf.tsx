import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/currency'
import { format } from 'date-fns'


interface StatementPDFProps {
  statement: any
  logoUrl?: string | null
  themeColor?: string
}

// Function to create dynamic styles with theme color
const createStyles = (themeColor: string = '#f97316') => StyleSheet.create({
  page: {
    padding: 30,
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  logoHeader: {
    width: 120,
    height: 'auto',
    marginBottom: 15,
    objectFit: 'contain',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 10,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 5,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1pt solid #e0e0e0',
    padding: 4,
    minHeight: 20,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    padding: 6,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    paddingHorizontal: 4,
  },
  tableCellSmall: {
    flex: 0.8,
    fontSize: 8,
    paddingHorizontal: 3,
  },
  tableCellLarge: {
    flex: 2,
    fontSize: 9,
    paddingHorizontal: 4,
  },
  summary: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  summaryRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 10,
  },
  total: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    paddingTop: 8,
    borderTop: `2pt solid ${themeColor}`,
  },
})

export function StatementPDF({ statement, logoUrl, themeColor = '#f97316' }: StatementPDFProps) {
  // Ensure themeColor is valid hex color
  const validThemeColor = /^#[0-9A-Fa-f]{6}$/.test(themeColor) ? themeColor : '#f97316'
  console.log('StatementPDF - Received themeColor:', themeColor, 'Using:', validThemeColor)
  
  const styles = createStyles(validThemeColor)
  
  // Get booking and expense maps if available
  const bookingMap = statement.bookingMap || {}
  const expenseMap = statement.expenseMap || {}
  
  // Separate statement lines into bookings and expenses, and match with actual data
  const bookingLines = (statement.statementLines?.filter((line: any) => line.type === 'booking') || [])
    .map((line: any) => ({
      ...line,
      booking: line.referenceId ? bookingMap[line.referenceId] : null,
    }))
    .sort((a: any, b: any) => {
      // Sort by check-in date if available
      if (a.booking?.checkInDate && b.booking?.checkInDate) {
        return new Date(a.booking.checkInDate).getTime() - new Date(b.booking.checkInDate).getTime()
      }
      return 0
    })
  
  const expenseLines = (statement.statementLines?.filter((line: any) => line.type === 'expense') || [])
    .map((line: any) => ({
      ...line,
      expense: line.referenceId ? expenseMap[line.referenceId] : null,
    }))
    .sort((a: any, b: any) => {
      // Sort by date if available
      if (a.expense?.date && b.expense?.date) {
        return new Date(b.expense.date).getTime() - new Date(a.expense.date).getTime()
      }
      return 0
    })
  
  // Calculate totals for display
  const totalBookings = bookingLines.length
  const totalRevenue = statement.grossRevenue || 0
  const totalExpenses = expenseLines.length
  const totalExpensesAmount = statement.totalExpenses || 0
  
  return (
    <Document>
      {/* Cover Page with Logo */}
      <Page size="A4" style={styles.coverPage}>
        {logoUrl && (
          <Image src={logoUrl} style={styles.logo} />
        )}
        <Text style={styles.coverTitle}>Statement of Account</Text>
        <Text style={styles.coverSubtitle}>
          {statement.owner.name}
        </Text>
      </Page>
      
      {/* Main Content - Header and Bookings */}
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          {logoUrl && (
            <Image src={logoUrl} style={styles.logoHeader} />
          )}
          <View style={styles.headerContent}>
            <Text style={styles.title}>Statement of Account</Text>
            <Text style={{ fontSize: 11, marginBottom: 5 }}>Owner: {statement.owner.name}</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>
              Period: {format(new Date(statement.periodStart), 'MMM d, yyyy')} to{' '}
              {format(new Date(statement.periodEnd), 'MMM d, yyyy')}
            </Text>
          </View>
        </View>

        {/* Bookings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Bookings ({totalBookings} {totalBookings === 1 ? 'booking' : 'bookings'})
          </Text>
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 10 }}>Total Revenue: {formatCurrency(totalRevenue, statement.displayCurrency)}</Text>
          </View>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellSmall}>Check In</Text>
              <Text style={styles.tableCellSmall}>Check Out</Text>
              <Text style={styles.tableCellLarge}>Property</Text>
              <Text style={styles.tableCell}>Guest</Text>
              <Text style={styles.tableCellSmall}>Nights</Text>
              <Text style={styles.tableCell}>Payout</Text>
              <Text style={styles.tableCellSmall}>Currency</Text>
              <Text style={styles.tableCellSmall}>Status</Text>
              <Text style={styles.tableCellSmall}>Source</Text>
            </View>
            {bookingLines.map((line: any, index: number) => {
              const booking = line.booking
              const checkIn = booking?.checkInDate ? format(new Date(booking.checkInDate), 'MMM d, yyyy') : ''
              const checkOut = booking?.checkOutDate ? format(new Date(booking.checkOutDate), 'MMM d, yyyy') : ''
              const propertyName = booking?.Property?.name || 'N/A'
              const guestName = booking?.guestName || 'N/A'
              const nights = booking?.nights || 0
              const payout = line.amountInDisplayCurrency
              const currency = statement.displayCurrency
              const status = booking?.status || 'COMPLETED'
              const source = booking?.source || (line.description?.includes('Company') ? 'DIRECT' : 'AIRBNB')
              
              return (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCellSmall} wrap>{checkIn || 'N/A'}</Text>
                  <Text style={styles.tableCellSmall} wrap>{checkOut || 'N/A'}</Text>
                  <Text style={styles.tableCellLarge} wrap>{propertyName}</Text>
                  <Text style={styles.tableCell} wrap>{guestName}</Text>
                  <Text style={styles.tableCellSmall} wrap>{nights}</Text>
                  <Text style={styles.tableCell} wrap>
                    {formatCurrency(payout, currency)}
                  </Text>
                  <Text style={styles.tableCellSmall} wrap>{currency}</Text>
                  <Text style={styles.tableCellSmall} wrap>{status}</Text>
                  <Text style={styles.tableCellSmall} wrap>{source}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Expenses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Expenses ({totalExpenses} {totalExpenses === 1 ? 'expense' : 'expenses'})
          </Text>
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 10 }}>Total Amount: {formatCurrency(totalExpensesAmount, statement.displayCurrency)}</Text>
          </View>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellSmall}>Date</Text>
              <Text style={styles.tableCellLarge}>Description</Text>
              <Text style={styles.tableCellLarge}>Property</Text>
              <Text style={styles.tableCell}>Category</Text>
              <Text style={styles.tableCell}>Amount</Text>
              <Text style={styles.tableCellSmall}>Currency</Text>
              <Text style={styles.tableCellSmall}>Related Task</Text>
            </View>
            {expenseLines.map((line: any, index: number) => {
              const expense = line.expense
              const expenseDate = expense?.date ? format(new Date(expense.date), 'MMM d, yyyy') : ''
              const description = expense?.description || line.description || 'N/A'
              const propertyName = expense?.Property?.name || 'N/A'
              const category = expense?.category || 'OTHER'
              const amount = line.amountInDisplayCurrency
              const currency = statement.displayCurrency
              
              return (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCellSmall} wrap>{expenseDate || 'N/A'}</Text>
                  <Text style={styles.tableCellLarge} wrap>{description}</Text>
                  <Text style={styles.tableCellLarge} wrap>{propertyName}</Text>
                  <Text style={styles.tableCell} wrap>{category}</Text>
                  <Text style={styles.tableCell} wrap>
                    {formatCurrency(amount, currency)}
                  </Text>
                  <Text style={styles.tableCellSmall} wrap>{currency}</Text>
                  <Text style={styles.tableCellSmall} wrap>-</Text>
                </View>
              )
            })}
          </View>
        </View>
      </Page>

      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.summary}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text>Revenue (Total):</Text>
            <Text>
              {formatCurrency(statement.grossRevenue, statement.displayCurrency)}
            </Text>
          </View>
          {(statement.companyRevenue > 0 || statement.ownerRevenue > 0) && (
            <>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 9 }]}>
                <Text>↳ Received by Company:</Text>
                <Text>
                  {formatCurrency(statement.companyRevenue || 0, statement.displayCurrency)}
                </Text>
              </View>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 9 }]}>
                <Text>↳ Received by Owner (already paid):</Text>
                <Text>
                  {formatCurrency(statement.ownerRevenue || 0, statement.displayCurrency)}
                </Text>
              </View>
            </>
          )}
          <View style={styles.summaryRow}>
            <Text>Commission (Total):</Text>
            <Text>
              {formatCurrency(
                statement.commissionAmount,
                statement.displayCurrency
              )}
            </Text>
          </View>
          {(statement.companyCommission > 0 || statement.ownerCommission > 0) && (
            <>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 9 }]}>
                <Text>↳ On Company bookings:</Text>
                <Text>
                  {formatCurrency(statement.companyCommission || 0, statement.displayCurrency)}
                </Text>
              </View>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 9 }]}>
                <Text>↳ On Owner bookings (owed to us):</Text>
                <Text>
                  {formatCurrency(statement.ownerCommission || 0, statement.displayCurrency)}
                </Text>
              </View>
            </>
          )}
          <View style={styles.summaryRow}>
            <Text>Gross (After Commission):</Text>
            <Text>
              {formatCurrency(
                statement.grossRevenue - statement.commissionAmount,
                statement.displayCurrency
              )}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Expenses:</Text>
            <Text>
              {formatCurrency(
                statement.totalExpenses,
                statement.displayCurrency
              )}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.total]}>
            <Text>Net to Owner:</Text>
            <Text>
              {formatCurrency(statement.netToOwner, statement.displayCurrency)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Opening Balance:</Text>
            <Text>
              {formatCurrency(
                statement.openingBalance,
                statement.displayCurrency
              )}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.total]}>
            <Text>Closing Balance:</Text>
            <Text>
              {formatCurrency(
                statement.closingBalance,
                statement.displayCurrency
              )}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

