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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/currency'
import { BookingStatus, Currency } from '@prisma/client'
import { format } from 'date-fns'
import { Calendar, Loader2 } from 'lucide-react'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'

interface Booking {
  id: string
  propertyId: string
  Property: {
    name: string
    nickname: string | null
  }
  source: string
  guestName: string | null
  checkInDate: Date | string
  checkOutDate: Date | string
  nights: number
  totalPayout: number
  currency: Currency
  status: BookingStatus
  checkedInAt: Date | string | null
}

export function OwnerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; name: string; nickname: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    if (properties.length > 0) {
      fetchBookings()
    }
  }, [propertyFilter, statusFilter, properties])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', {
        credentials: 'include',
      })
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
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter)
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const res = await fetch(`/api/bookings?${params.toString()}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to fetch bookings')
      }

      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: BookingStatus) => {
    const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
      UPCOMING: { label: 'Upcoming', className: 'bg-blue-100 text-blue-800' },
      CHECKED_IN: { label: 'Checked In', className: 'bg-green-100 text-green-800' },
      COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-800' },
      CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    }
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const filteredBookings = bookings.filter((booking) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        booking.guestName?.toLowerCase().includes(query) ||
        booking.Property.name.toLowerCase().includes(query) ||
        booking.Property.nickname?.toLowerCase().includes(query) ||
        booking.source.toLowerCase().includes(query)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Bookings
        </h1>
        <p className="text-gray-600 mt-1">View all bookings for your properties</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property-filter">Property</Label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger id="property-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.nickname || property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by guest name, property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredBookings.length} {filteredBookings.length === 1 ? 'Booking' : 'Bookings'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeletonLoader columns={7} rows={5} />
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        {booking.Property.nickname || booking.Property.name}
                      </TableCell>
                      <TableCell>{booking.guestName || 'N/A'}</TableCell>
                      <TableCell>
                        {format(new Date(booking.checkInDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(booking.checkOutDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{booking.nights}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{booking.source}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(booking.totalPayout, booking.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

