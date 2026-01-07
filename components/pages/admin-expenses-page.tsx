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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Edit, Receipt, DollarSign, TrendingDown, Calendar, FileText, CheckSquare, Square, Trash2, Download, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { formatCurrency, convertCurrency } from '@/lib/currency'
import { ExpenseCategory, Currency } from '@prisma/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'
import { Pagination } from '@/components/ui/pagination'

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

export function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [totalAmount, setTotalAmount] = useState(0)
  const [currentMonthTotal, setCurrentMonthTotal] = useState(0)
  const [prevMonthTotal, setPrevMonthTotal] = useState(0)
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState<Expense[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [filters, setFilters] = useState({
    propertyId: '',
    category: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  useEffect(() => {
    const calculateMetrics = async () => {
      const now = new Date()
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)
      const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))

      // Calculate total amount
      let total = 0
      for (const e of allExpenses) {
        total += await convertCurrency(e.amount, e.currency, 'GHS')
      }
      setTotalAmount(total)

      // Calculate current month total
      const currentMonthExpensesFiltered = allExpenses.filter(e => {
        const date = new Date(e.date)
        return date >= monthStart && date <= monthEnd
      })
      setCurrentMonthExpenses(currentMonthExpensesFiltered)
      let currentTotal = 0
      for (const e of currentMonthExpensesFiltered) {
        currentTotal += await convertCurrency(e.amount, e.currency, 'GHS')
      }
      setCurrentMonthTotal(currentTotal)

      // Calculate previous month total
      const prevMonthExpenses = allExpenses.filter(e => {
        const date = new Date(e.date)
        return date >= prevMonthStart && date <= prevMonthEnd
      })
      let prevTotal = 0
      for (const e of prevMonthExpenses) {
        prevTotal += await convertCurrency(e.amount, e.currency, 'GHS')
      }
      setPrevMonthTotal(prevTotal)
    }
    calculateMetrics()
  }, [allExpenses])

  const fetchExpenses = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.propertyId) params.append('propertyId', filters.propertyId)
      if (filters.category) params.append('category', filters.category)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const res = await fetch(`/api/expenses?${params.toString()}`)
      const data = await res.json()
      // Handle error response or ensure data is an array
      setExpenses(Array.isArray(data) ? data : [])
      
      // Fetch all expenses for metrics
      const allRes = await fetch('/api/expenses')
      const allData = await allRes.json()
      setAllExpenses(Array.isArray(allData) ? allData : [])
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
      setExpenses([])
      setAllExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const applyFilters = () => {
    setLoading(true)
    fetchExpenses()
  }

  const handleSelectAll = () => {
    if (selectedExpenses.size === expenses.length) {
      setSelectedExpenses(new Set())
    } else {
      setSelectedExpenses(new Set(expenses.map(e => e.id)))
    }
  }

  const handleSelectExpense = (expenseId: string) => {
    const newSelected = new Set(selectedExpenses)
    if (newSelected.has(expenseId)) {
      newSelected.delete(expenseId)
    } else {
      newSelected.add(expenseId)
    }
    setSelectedExpenses(newSelected)
  }

  const handleBulkUpdateCategory = async (category: ExpenseCategory) => {
    if (selectedExpenses.size === 0) return
    if (!confirm(`Update ${selectedExpenses.size} expense(s) to category ${category}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/expenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedExpenses),
          action: 'updateCategory',
          data: { category },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update expenses')
      }
      toast.success('Bulk update successful', `Updated ${selectedExpenses.size} expense(s)`)
      setSelectedExpenses(new Set())
      fetchExpenses()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedExpenses.size === 0) return
    if (!confirm(`Delete ${selectedExpenses.size} expense(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/expenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedExpenses),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete expenses')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedExpenses.size} expense(s)`)
      setSelectedExpenses(new Set())
      fetchExpenses()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedExpenses.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/expenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedExpenses),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export expenses')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedExpenses.size} expense(s)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  // Calculate metrics
  const totalExpenses = allExpenses.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Link href="/admin/expenses/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Expenses"
          value={totalExpenses}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Amount"
          value={formatCurrency(totalAmount, Currency.GHS)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="This Month"
          value={formatCurrency(currentMonthTotal, Currency.GHS)}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          trend={{
            value: currentMonthTotal - prevMonthTotal,
            period: 'vs last month',
            isPositive: currentMonthTotal <= prevMonthTotal, // Lower is better
          }}
        />
        <MetricCard
          title="This Month Count"
          value={currentMonthExpenses.length}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {Object.values(ExpenseCategory).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={applyFilters} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-12 h-12" />}
          title="No expenses found"
          description="Start tracking your property expenses by adding your first expense record."
          action={{
            label: 'Add Expense',
            href: '/admin/expenses/new',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Expenses</CardTitle>
              {selectedExpenses.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedExpenses.size} selected
                  </span>
                  <Select
                    onValueChange={(value) => handleBulkUpdateCategory(value as ExpenseCategory)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ExpenseCategory).map((category) => (
                        <SelectItem key={category} value={category}>
                          Set to {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedExpenses(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {selectedExpenses.size === expenses.length && expenses.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <button
                      onClick={() => handleSelectExpense(expense.id)}
                      className="flex items-center justify-center"
                    >
                      {selectedExpenses.has(expense.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {expense.Property.name}
                  </TableCell>
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
                  <TableCell>
                    {expense.attachmentUrl ? (
                      <a
                        href={expense.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/expenses/${expense.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                  </TableCell>
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
    </div>
  )
}

