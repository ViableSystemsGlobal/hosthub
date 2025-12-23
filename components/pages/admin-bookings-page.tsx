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
import { Plus, Edit, Calendar, DollarSign, CalendarCheck, TrendingUp, CalendarDays, CheckSquare, Square, Trash2, Download, Mail, Loader2, Upload } from 'lucide-react'
import { formatCurrency, convertCurrency } from '@/lib/currency'
import { BookingSource, BookingStatus, Currency } from '@prisma/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'
import { TrendChart } from '@/components/ui/trend-chart'
import { toast } from '@/lib/toast'
import { CSVImportDialog } from '@/components/pages/csv-import-dialog'

interface Booking {
  id: string
  source: BookingSource
  guestName?: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalPayout: number
  currency: Currency
  status: BookingStatus
  Property: {
    name: string
  }
  Owner: {
    name: string
  }
}

export function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [allBookings, setAllBookings] = useState<Booking[]>([]) // Store all bookings for metrics
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [filters, setFilters] = useState({
    propertyId: '',
    source: '',
    status: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.propertyId) params.append('propertyId', filters.propertyId)
      if (filters.source) params.append('source', filters.source)
      if (filters.status) params.append('status', filters.status)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const res = await fetch(`/api/bookings?${params.toString()}`, {
        credentials: 'include',
      })
      
      // Handle authentication errors
      if (res.status === 401 || res.status === 403) {
        console.error('Authentication required')
        setBookings([])
        setAllBookings([])
        // Optionally redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }
      
      if (!res.ok) {
        let errorMessage = 'Failed to fetch bookings'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await res.text()
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
      
      // Fetch all bookings for metrics (without filters)
      const allRes = await fetch('/api/bookings', {
        credentials: 'include',
      })
      
      // Handle authentication errors
      if (allRes.status === 401 || allRes.status === 403) {
        console.error('Authentication required for all bookings')
        setAllBookings([])
        return
      }
      
      if (!allRes.ok) {
        let errorMessage = 'Failed to fetch all bookings'
        try {
          const errorData = await allRes.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await allRes.text()
          errorMessage = errorText || errorMessage
        }
        console.error('Failed to fetch all bookings:', errorMessage)
        setAllBookings([])
        return
      }
      
      const allData = await allRes.json()
      setAllBookings(Array.isArray(allData) ? allData : [])
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
      setBookings([])
      setAllBookings([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const applyFilters = () => {
    setLoading(true)
    fetchBookings()
  }

  const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      // Show success toast
      toast.success('Status updated', `Booking status changed to ${newStatus}`)

      // Refresh bookings
      fetchBookings()
    } catch (error) {
      console.error('Failed to update booking status:', error)
      toast.error('Update failed', 'Failed to update booking status. Please try again.')
    }
  }

  const handleSelectAll = () => {
    if (selectedBookings.size === bookings.length) {
      setSelectedBookings(new Set())
    } else {
      setSelectedBookings(new Set(bookings.map(b => b.id)))
    }
  }

  const handleSelectBooking = (bookingId: string) => {
    const newSelected = new Set(selectedBookings)
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId)
    } else {
      newSelected.add(bookingId)
    }
    setSelectedBookings(newSelected)
  }

  const handleBulkUpdateStatus = async (newStatus: BookingStatus) => {
    if (selectedBookings.size === 0) return

    if (!confirm(`Update ${selectedBookings.size} booking(s) to ${newStatus}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedBookings),
          action: 'updateStatus',
          data: { status: newStatus },
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update bookings')
      }

      toast.success('Bulk update successful', `Updated ${selectedBookings.size} booking(s)`)
      setSelectedBookings(new Set())
      fetchBookings()
    } catch (error: any) {
      console.error('Bulk update failed:', error)
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedBookings.size === 0) return

    if (!confirm(`Delete ${selectedBookings.size} booking(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedBookings),
          action: 'delete',
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete bookings')
      }

      toast.success('Bulk delete successful', `Deleted ${selectedBookings.size} booking(s)`)
      setSelectedBookings(new Set())
      fetchBookings()
    } catch (error: any) {
      console.error('Bulk delete failed:', error)
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedBookings.size === 0) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedBookings),
          action: 'export',
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export bookings')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bookings-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Export successful', `Exported ${selectedBookings.size} booking(s)`)
    } catch (error: any) {
      console.error('Bulk export failed:', error)
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
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
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

  // Calculate metrics from all bookings
  const totalBookings = Array.isArray(allBookings) ? allBookings.length : 0
  const completedBookings = Array.isArray(allBookings) ? allBookings.filter(b => b.status === 'COMPLETED').length : 0
  const totalRevenue = Array.isArray(allBookings) ? allBookings
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => {
      const gross = (b as any).baseAmount + ((b as any).cleaningFee || 0)
      return sum + convertCurrency(gross, b.currency, 'GHS')
    }, 0) : 0
  const upcomingBookings = Array.isArray(allBookings) ? allBookings.filter(b => b.status === 'UPCOMING').length : 0

  // Calculate previous month for trend
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  
  const currentMonthBookings = Array.isArray(allBookings) ? allBookings.filter(b => {
    const checkIn = new Date(b.checkInDate)
    return checkIn >= monthStart && checkIn <= monthEnd
  }).length : 0
  
  const prevMonthBookings = Array.isArray(allBookings) ? allBookings.filter(b => {
    const checkIn = new Date(b.checkInDate)
    return checkIn >= prevMonthStart && checkIn <= prevMonthEnd
  }).length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Link href="/admin/bookings/calendar">
            <Button variant="outline">
              <CalendarDays className="w-4 h-4 mr-2" />
              Calendar View
            </Button>
          </Link>
          <Link href="/admin/bookings/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Booking
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bookings"
          value={totalBookings}
          icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
          trend={{
            value: currentMonthBookings - prevMonthBookings,
            period: 'vs last month',
            isPositive: currentMonthBookings >= prevMonthBookings,
          }}
        />
        <MetricCard
          title="Completed"
          value={completedBookings}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Upcoming"
          value={upcomingBookings}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue, Currency.GHS)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={filters.source || 'all'}
                onValueChange={(value) => handleFilterChange('source', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {Object.values(BookingSource).map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.values(BookingStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
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

      {bookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="No bookings found"
          description="Start tracking your property bookings by adding your first booking."
          action={{
            label: 'Add Booking',
            href: '/admin/bookings/new',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Bookings</CardTitle>
              {selectedBookings.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedBookings.size} selected
                  </span>
                  <Select
                    onValueChange={(value) => handleBulkUpdateStatus(value as BookingStatus)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(BookingStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          Set to {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (selectedBookings.size === 0) return
                      try {
                        setBulkActionLoading(true)
                        const res = await fetch('/api/bookings/bulk', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            ids: Array.from(selectedBookings),
                            action: 'sendNotifications',
                          }),
                        })
                        if (!res.ok) {
                          const error = await res.json()
                          throw new Error(error.error || 'Failed to send notifications')
                        }
                        toast.success('Notifications sent', `Sent notifications for ${selectedBookings.size} booking(s)`)
                      } catch (error: any) {
                        toast.error('Failed to send notifications', error.message)
                      } finally {
                        setBulkActionLoading(false)
                      }
                    }}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                  </Button>
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
                    onClick={() => setSelectedBookings(new Set())}
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
                      {selectedBookings.size === bookings.length && bookings.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <button
                        onClick={() => handleSelectBooking(booking.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedBookings.has(booking.id) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.Property.name}
                    </TableCell>
                    <TableCell>{booking.guestName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(booking.checkOutDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{booking.nights}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.source}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(booking.totalPayout, booking.currency)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={booking.status}
                        onValueChange={(value) =>
                          updateBookingStatus(booking.id, value as BookingStatus)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(BookingStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/bookings/${booking.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CSVImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={() => {
          fetchBookings()
          setShowImportDialog(false)
        }}
      />
    </div>
  )
}

