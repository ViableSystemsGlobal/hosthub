'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
// Define StatementStatus locally to avoid build issues if Prisma client is stale
enum StatementStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED'
}
import { format } from 'date-fns'

interface Statement {
  id: string
  periodStart: string
  periodEnd: string
  status: StatementStatus
  grossRevenue: number
  totalExpenses: number
  commissionAmount: number
  netToOwner: number
  displayCurrency: Currency
  pdfUrl?: string
}

export default function OwnerStatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatements()
  }, [])

  const fetchStatements = async () => {
    try {
      const res = await fetch('/api/statements')
      const data = await res.json()
      setStatements(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch statements:', error)
      setStatements([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Statements</h1>

      <Card>
        <CardHeader>
          <CardTitle>Statements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross Revenue</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Net to Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map((statement) => (
                <TableRow key={statement.id}>
                  <TableCell>
                    {format(new Date(statement.periodStart), 'MMM dd')} -{' '}
                    {format(new Date(statement.periodEnd), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      statement.grossRevenue,
                      statement.displayCurrency
                    )}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      statement.totalExpenses,
                      statement.displayCurrency
                    )}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      statement.commissionAmount,
                      statement.displayCurrency
                    )}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      statement.netToOwner,
                      statement.displayCurrency
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        statement.status === StatementStatus.FINALIZED
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {statement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {statement.status === StatementStatus.FINALIZED && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = `/api/statements/${statement.id}/download`
                          link.download = `statement-${statement.id}.pdf`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

