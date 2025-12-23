'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Clock, Calendar, Building2, User, Search, Filter } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { BookingStatus, Currency } from '@prisma/client'
import { format, isToday, isTomorrow, startOfToday } from 'date-fns'
import { toast } from '@/lib/toast'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { EmptyState } from '@/components/ui/empty-state'

interface Booking {
  id: string
  guestName?: string | null
  checkInDate: string
  checkOutDate: string
  nights: number
  totalPayout: number
  currency: Currency
  status: BookingStatus
  checkedInAt?: string | null
  checkedInBy?: {
    name?: string | null
    email?: string | null
  } | null
  checkInNotes?: string | null
  Property: {
    id: string
    name: string
    nickname?: string | null
  }
  Owner: {
    name: string
  }
}

export function AdminCheckInPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [checkInNotes, setCheckInNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filters, setFilters] = useState({
    propertyId: '',
    dateFilter: 'upcoming', // 'today', 'tomorrow', 'upcoming', 'all'
    search: '',
  })
  const [properties, setProperties] = useState<any[]>([])

  useEffect(() => {
    fetchBookings()
    fetchProperties()
  }, [filters])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('status', BookingStatus.UPCOMING)
      
      if (filters.propertyId) {
        params.append('propertyId', filters.propertyId)
      }

      const res = await fetch(`/api/bookings?${params.toString()}`, {
        credentials: 'include',
      })

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        throw new Error('Failed to fetch bookings')
      }

      let data = await res.json()
      if (!Array.isArray(data)) {
        data = []
      }

      // Filter by date
      const today = startOfToday()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      let filtered = data.filter((booking: Booking) => {
        const checkIn = new Date(booking.checkInDate)
        
        if (filters.dateFilter === 'today') {
          return isToday(checkIn)
        } else if (filters.dateFilter === 'tomorrow') {
          return isTomorrow(checkIn)
        } else if (filters.dateFilter === 'upcoming') {
          return checkIn >= today
        }
        return true
      })

      // Filter by search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filtered = filtered.filter((booking: Booking) => {
          return (
            booking.guestName?.toLowerCase().includes(searchLower) ||
            booking.Property.name.toLowerCase().includes(searchLower) ||
            booking.Property.nickname?.toLowerCase().includes(searchLower) ||
            booking.Owner.name.toLowerCase().includes(searchLower)
          )
        })
      }

      // Sort by check-in date (soonest first)
      filtered.sort((a: Booking, b: Booking) => {
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
      })

      setBookings(filtered)
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
      setBookings([])
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = (booking: Booking) => {
    setSelectedBooking(booking)
    setCheckInNotes(booking.checkInNotes || '')
    setCheckInDialogOpen(true)
  }

  const submitCheckIn = async () => {
    if (!selectedBooking) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: checkInNotes }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to check in guest')
      }

      toast.success('Guest checked in successfully')
      setCheckInDialogOpen(false)
      setSelectedBooking(null)
      setCheckInNotes('')
      fetchBookings()
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest')
    } finally {
      setSubmitting(false)
    }
  }

  const getCheckInDateLabel = (date: string) => {
    const checkIn = new Date(date)
    if (isToday(checkIn)) {
      return 'Today'
    } else if (isTomorrow(checkIn)) {
      return 'Tomorrow'
    }
    return format(checkIn, 'MMM dd, yyyy')
  }

  const getCheckInTime = (date: string) => {
    const checkIn = new Date(date)
    const hours = checkIn.getHours()
    const minutes = checkIn.getMinutes()
    
    // If time is midnight (00:00), it might be a date-only field, so don't show time
    if (hours === 0 && minutes === 0) {
      return null
    }
    
    return format(checkIn, 'HH:mm')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Guest Check-In</CardTitle>
          </CardHeader>
          <CardContent>
            <TableSkeletonLoader rows={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Guest Check-In
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Guest, property, owner..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select
                value={filters.propertyId || 'all'}
                onValueChange={(value) => setFilters({ ...filters, propertyId: value === 'all' ? '' : value })}
              >
                <SelectTrigger id="property">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFilter">Date</Label>
              <Select
                value={filters.dateFilter}
                onValueChange={(value) => setFilters({ ...filters, dateFilter: value })}
              >
                <SelectTrigger id="dateFilter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({ propertyId: '', dateFilter: 'upcoming', search: '' })}
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Bookings Table */}
          {bookings.length === 0 ? (
            <EmptyState
              title="No upcoming bookings"
              description="There are no bookings to check in at the moment."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check-In Date</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">
                            {getCheckInDateLabel(booking.checkInDate)}
                          </div>
                          {getCheckInTime(booking.checkInDate) && (
                            <div className="text-xs text-gray-500">
                              {getCheckInTime(booking.checkInDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {booking.guestName || (
                        <span className="text-gray-400">No name</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{booking.Property.name}</div>
                          {booking.Property.nickname && (
                            <div className="text-xs text-gray-500">
                              {booking.Property.nickname}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {booking.Owner.name}
                      </div>
                    </TableCell>
                    <TableCell>{booking.nights} nights</TableCell>
                    <TableCell>
                      {booking.checkedInAt ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {booking.checkedInAt ? (
                        <div className="text-sm text-gray-600">
                          <div>Checked in</div>
                          <div className="text-xs">
                            {format(new Date(booking.checkedInAt), 'MMM dd, HH:mm')}
                          </div>
                          {booking.checkedInBy?.name && (
                            <div className="text-xs">by {booking.checkedInBy.name}</div>
                          )}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCheckIn(booking)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Check In
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Check-In Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In Guest</DialogTitle>
            <DialogDescription>
              Mark this guest as checked in. You can add optional notes.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Guest:</span>
                  <span className="text-sm font-medium">
                    {selectedBooking.guestName || 'No name'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Property:</span>
                  <span className="text-sm font-medium">
                    {selectedBooking.Property.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Check-In:</span>
                  <span className="text-sm font-medium">
                    {format(new Date(selectedBooking.checkInDate), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Check-Out:</span>
                  <span className="text-sm font-medium">
                    {format(new Date(selectedBooking.checkOutDate), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nights:</span>
                  <span className="text-sm font-medium">{selectedBooking.nights}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  placeholder="Add any notes about the check-in..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCheckIn} disabled={submitting}>
              {submitting ? 'Checking in...' : 'Check In Guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

