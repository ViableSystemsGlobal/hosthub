'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { Plus, Eye, FileDown, FileText, DollarSign, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
// Define StatementStatus locally to avoid build issues if Prisma client is stale
enum StatementStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED'
}
import { format } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'
import { toast } from '@/lib/toast'

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
  Owner: {
    name: string
  }
  pdfUrl?: string
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatements()
  }, [])

  const fetchStatements = async () => {
    try {
      const res = await fetch('/api/statements')
      const data = await res.json()
      // Handle error response or ensure data is an array
      setStatements(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch statements:', error)
      setStatements([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statements</h1>
        <Link href="/admin/statements/generate">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Generate Statement
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Statements"
          value={statements.length}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Finalized"
          value={statements.filter(s => s.status === StatementStatus.FINALIZED).length}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Draft"
          value={statements.filter(s => s.status === StatementStatus.DRAFT).length}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Net to Owners (Finalized)"
          value={formatCurrency(
            statements
              .filter(s => s.status === StatementStatus.FINALIZED)
              .reduce((sum, s) => sum + s.netToOwner, 0),
            Currency.GHS
          )}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {statements.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No statements yet"
          description="Generate your first statement to track owner payouts and financial summaries."
          action={{
            label: 'Generate Statement',
            href: '/admin/statements/generate',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
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
                  <TableCell className="font-medium">
                    {statement.Owner.name}
                  </TableCell>
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
                    <div className="flex gap-2">
                      <Link href={`/admin/statements/${statement.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      {statement.status === StatementStatus.FINALIZED && (
                        <a href={`/api/statements/${statement.id}/download`} download>
                          <Button variant="outline" size="sm">
                            <FileDown className="w-4 h-4" />
                          </Button>
                        </a>
                      )}
                      {statement.status === StatementStatus.DRAFT && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to delete this draft statement for ${statement.Owner.name}? This action cannot be undone.`)) {
                              return
                            }
                            try {
                              const res = await fetch(`/api/statements/${statement.id}`, {
                                method: 'DELETE',
                              })
                              const data = await res.json()
                              if (!res.ok) {
                                throw new Error(data.error || 'Failed to delete statement')
                              }
                              toast.success('Statement deleted', 'The statement has been deleted successfully')
                              fetchStatements()
                            } catch (error: any) {
                              console.error('Failed to delete statement:', error)
                              toast.error('Delete failed', error.message)
                            }
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  )
}

