'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
// Define StatementStatus locally to avoid build issues if Prisma client is stale
enum StatementStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED'
}
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { FileDown } from 'lucide-react'

export default function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [statement, setStatement] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    fetchStatement()
  }, [id])

  const fetchStatement = async () => {
    try {
      const res = await fetch(`/api/statements/${id}`)
      const data = await res.json()
      setStatement(data)
    } catch (error) {
      console.error('Failed to fetch statement:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFinalize = async () => {
    setShowConfirmDialog(false)
    setFinalizing(true)
    try {
      const res = await fetch(`/api/statements/${id}/finalize`, {
        method: 'POST',
      })

      if (res.ok) {
        // Download PDF
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `statement-${id}.pdf`
        a.click()
        
        toast.success('Statement finalized', 'The statement has been finalized and PDF downloaded')
        router.push('/admin/statements')
        router.refresh()
      } else {
        const error = await res.json()
        toast.error('Failed to finalize', error.error || 'Failed to finalize statement')
      }
    } catch (error: any) {
      toast.error('Error', error.message)
    } finally {
      setFinalizing(false)
    }
  }

  if (loading || !statement) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statement Details</h1>
        <div className="flex gap-2">
          {statement.status === StatementStatus.FINALIZED && (
            <Button variant="outline" asChild>
              <a href={`/api/statements/${id}/download`} download>
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF
              </a>
            </Button>
          )}
          {statement.status === StatementStatus.DRAFT && (
            <>
              <Button onClick={() => setShowConfirmDialog(true)} disabled={finalizing}>
                {finalizing ? 'Finalizing...' : 'Finalize Statement'}
              </Button>
              <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Finalize Statement</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to finalize this statement? This will update the owner wallet and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleFinalize} asChild>
                      <Button>Finalize</Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Owner</div>
              <div className="font-medium">{statement.owner?.name || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Period</div>
              <div className="font-medium">
                {format(new Date(statement.periodStart), 'MMM dd')} -{' '}
                {format(new Date(statement.periodEnd), 'MMM dd, yyyy')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <Badge
                variant={
                  statement.status === StatementStatus.FINALIZED
                    ? 'default'
                    : 'secondary'
                }
              >
                {statement.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-600">Net to Owner</div>
              <div className="font-medium">
                {formatCurrency(statement.netToOwner, statement.displayCurrency)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Revenue Breakdown */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Revenue</h4>
              <div className="flex justify-between">
                <span>Revenue (Total):</span>
                <span className="font-medium">
                  {formatCurrency(statement.grossRevenue, statement.displayCurrency)}
                </span>
              </div>
              {(statement.companyRevenue > 0 || statement.ownerRevenue > 0) && (
                <div className="pl-4 text-sm space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>↳ Received by Company:</span>
                    <span>{formatCurrency(statement.companyRevenue || 0, statement.displayCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>↳ Received by Owner (already paid):</span>
                    <span>{formatCurrency(statement.ownerRevenue || 0, statement.displayCurrency)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Commission Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Commission (Total):</span>
                <span className="font-medium">
                  {formatCurrency(statement.commissionAmount, statement.displayCurrency)}
                </span>
              </div>
              {(statement.companyCommission > 0 || statement.ownerCommission > 0) && (
                <div className="pl-4 text-sm space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>↳ On Company bookings (deducted):</span>
                    <span>{formatCurrency(statement.companyCommission || 0, statement.displayCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>↳ On Owner bookings (owed to us):</span>
                    <span>{formatCurrency(statement.ownerCommission || 0, statement.displayCurrency)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Gross After Commission */}
            <div className="flex justify-between">
              <span>Gross (After Commission):</span>
              <span className="font-medium">
                {formatCurrency(
                  statement.grossRevenue - statement.commissionAmount,
                  statement.displayCurrency
                )}
              </span>
            </div>

            {/* Expenses */}
            <div className="flex justify-between">
              <span>Total Expenses:</span>
              <span className="font-medium">
                {formatCurrency(statement.totalExpenses, statement.displayCurrency)}
              </span>
            </div>

            {/* Net Calculation Explanation */}
            {(statement.companyRevenue > 0 || statement.ownerRevenue > 0) && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                <h4 className="font-semibold text-muted-foreground">Net Calculation:</h4>
                <div className="flex justify-between">
                  <span>Company bookings net (we owe owner):</span>
                  <span className="text-green-600">
                    +{formatCurrency(
                      (statement.companyRevenue || 0) - (statement.companyCommission || 0) - statement.totalExpenses,
                      statement.displayCurrency
                    )}
                  </span>
                </div>
                {statement.ownerCommission > 0 && (
                  <div className="flex justify-between">
                    <span>Owner bookings commission (owner owes us):</span>
                    <span className="text-red-600">
                      -{formatCurrency(statement.ownerCommission || 0, statement.displayCurrency)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between border-t pt-2 font-bold">
              <span>Net to Owner:</span>
              <span>
                {formatCurrency(statement.netToOwner, statement.displayCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Opening Balance:</span>
              <span>
                {formatCurrency(statement.openingBalance, statement.displayCurrency)}
              </span>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-sm space-y-1 border-l-4 border-blue-500">
              <div className="font-semibold text-blue-900 mb-1">Balance Calculation:</div>
              <div className="flex justify-between text-blue-800">
                <span>Opening Balance:</span>
                <span>{formatCurrency(statement.openingBalance, statement.displayCurrency)}</span>
              </div>
              <div className="flex justify-between text-blue-800">
                <span>+ Net to Owner:</span>
                <span>+{formatCurrency(statement.netToOwner, statement.displayCurrency)}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-900 border-t border-blue-200 pt-1 mt-1">
                <span>= Closing Balance:</span>
                <span>{formatCurrency(statement.closingBalance, statement.displayCurrency)}</span>
              </div>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>Closing Balance:</span>
              <span>
                {formatCurrency(statement.closingBalance, statement.displayCurrency)}
              </span>
            </div>
            {statement.commissionsPayable !== undefined && statement.commissionsPayable > 0 && (
              <div className="flex justify-between border-t pt-2 text-orange-600 font-semibold">
                <span>Commissions Payable:</span>
                <span>
                  {formatCurrency(statement.commissionsPayable, statement.displayCurrency)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statement Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.statementLines?.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <Badge variant="outline">{line.type}</Badge>
                  </TableCell>
                  <TableCell>{line.description}</TableCell>
                  <TableCell>
                    {formatCurrency(
                      line.amountInDisplayCurrency,
                      statement.displayCurrency
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

