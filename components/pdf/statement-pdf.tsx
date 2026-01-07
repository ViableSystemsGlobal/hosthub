import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/currency'


interface StatementPDFProps {
  statement: any
  logoUrl?: string | null
  themeColor?: string
}

// Function to create dynamic styles with theme color
const createStyles = (themeColor: string = '#f97316') => StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
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
    marginBottom: 30,
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
    width: 150,
    height: 'auto',
    marginBottom: 20,
    objectFit: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
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
    padding: 8,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
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
    marginBottom: 8,
  },
  total: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    paddingTop: 10,
    borderTop: `2pt solid ${themeColor}`,
  },
})

export function StatementPDF({ statement, logoUrl, themeColor = '#f97316' }: StatementPDFProps) {
  // Ensure themeColor is valid hex color
  const validThemeColor = /^#[0-9A-Fa-f]{6}$/.test(themeColor) ? themeColor : '#f97316'
  console.log('StatementPDF - Received themeColor:', themeColor, 'Using:', validThemeColor)
  
  const styles = createStyles(validThemeColor)
  
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
      
      {/* Main Content Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoUrl && (
            <Image src={logoUrl} style={styles.logoHeader} />
          )}
          <View style={styles.headerContent}>
            <Text style={styles.title}>Statement of Account</Text>
            <Text>Owner: {statement.owner.name}</Text>
            <Text>
              Period: {new Date(statement.periodStart).toLocaleDateString()} to{' '}
              {new Date(statement.periodEnd).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>
            Transactions
          </Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Description</Text>
              <Text style={styles.tableCell}>Amount</Text>
            </View>
            {statement.statementLines.map((line: any, index: number) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{line.description}</Text>
                <Text style={styles.tableCell}>
                  {formatCurrency(
                    line.amountInDisplayCurrency,
                    statement.displayCurrency
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Revenue (Total):</Text>
            <Text>
              {formatCurrency(statement.grossRevenue, statement.displayCurrency)}
            </Text>
          </View>
          {(statement.companyRevenue > 0 || statement.ownerRevenue > 0) && (
            <>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 10 }]}>
                <Text>↳ Received by Company:</Text>
                <Text>
                  {formatCurrency(statement.companyRevenue || 0, statement.displayCurrency)}
                </Text>
              </View>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 10 }]}>
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
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 10 }]}>
                <Text>↳ On Company bookings:</Text>
                <Text>
                  {formatCurrency(statement.companyCommission || 0, statement.displayCurrency)}
                </Text>
              </View>
              <View style={[styles.summaryRow, { paddingLeft: 15, fontSize: 10 }]}>
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

