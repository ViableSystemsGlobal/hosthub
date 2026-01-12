'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
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
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { Receipt, Plus, DollarSign, Edit, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { ExpenseCategory, Currency } from '@prisma/client'
import { format } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'
import { Pagination } from '@/components/ui/pagination'
import { toast } from '@/lib/toast'
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

interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  currency: Currency
  date: string
  Property: {
    name: string
  }
  Owner: {
    name: string
  }
  attachmentUrl?: string
}

export function ManagerExpensesPage() {
  const { data: session } = useSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
  const pageSize = 10

  // Check if user is General Manager (can edit/delete)
  const isGeneralManager = session?.user?.role === 'GENERAL_MANAGER'

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses')
      if (!res.ok) {
        throw new Error('Failed to fetch expenses')
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setExpenses(data)
      } else {
        setExpenses([])
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete expense')
      }
      toast.success('Expense deleted successfully')
      fetchExpenses()
    } catch (error) {
      console.error('Failed to delete expense:', error)
      toast.error('Failed to delete expense')
    } finally {
      setDeleteDialogOpen(false)
      setExpenseToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  // Calculate metrics
  const totalExpenses = expenses.length
  const thisMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date)
    const now = new Date()
    return expenseDate.getMonth() === now.getMonth() && 
           expenseDate.getFullYear() === now.getFullYear()
  })
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => {
    const amountInGHS = e.currency === Currency.GHS ? e.amount : e.amount * 12 // Approximate conversion
    return sum + amountInGHS
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Link href="/manager/expenses/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Expense
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Expenses"
          value={totalExpenses}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="This Month Expenses"
          value={formatCurrency(thisMonthTotal, Currency.GHS)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="This Month Count"
          value={thisMonthExpenses.length}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-12 h-12" />}
          title="No expenses found"
          description="Expenses for your assigned properties will appear here."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  {isGeneralManager && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">
                      {expense.Property.name}
                    </TableCell>
                    <TableCell>{expense.Owner.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{expense.category}</Badge>
                    </TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>
                      {format(new Date(expense.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(expense.amount, expense.currency)}
                    </TableCell>
                    {isGeneralManager && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/manager/expenses/${expense.id}/edit`}>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExpenseToDelete(expense.id)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {expenses.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(expenses.length / pageSize)}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                totalItems={expenses.length}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => expenseToDelete && handleDelete(expenseToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

