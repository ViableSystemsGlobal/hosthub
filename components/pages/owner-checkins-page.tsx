'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck, Filter } from 'lucide-react'
import { BookingStatus } from '@prisma/client'
import { format } from 'date-fns'

interface Booking {
  id: string
  guestName: string | null
  checkInDate: Date
  checkOutDate: Date
  checkedInAt: Date | null
  checkInNotes: string | null
  Property: {
    id: string
    name: string
    nickname: string | null
  }
  CheckedInBy: {
    id: string
    name: string
    email: string
  } | null
  status: BookingStatus
}

export function OwnerCheckInsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; name: string; nickname: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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
        setProperties(data || [])
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
    switch (status) {
      case BookingStatus.COMPLETED:
        return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>
      case BookingStatus.UPCOMING:
        return <Badge className="bg-green-100 text-green-800">Upcoming</Badge>
      case BookingStatus.CANCELLED:
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="w-6 h-6" />
            Check-Ins
          </h1>
          <p className="text-gray-600 mt-1">View check-in status for your bookings</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Property</label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Properties" />
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
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={BookingStatus.UPCOMING}>Upcoming</SelectItem>
                  <SelectItem value={BookingStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value={BookingStatus.CANCELLED}>Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarCheck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No bookings found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-In Date</TableHead>
                  <TableHead>Check-Out Date</TableHead>
                  <TableHead>Checked In</TableHead>
                  <TableHead>Checked In By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.Property.nickname || booking.Property.name}
                    </TableCell>
                    <TableCell>{booking.guestName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(booking.checkOutDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {booking.checkedInAt ? (
                        <Badge className="bg-green-100 text-green-800">
                          {format(new Date(booking.checkedInAt), 'MMM dd, yyyy HH:mm')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Checked In</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {booking.CheckedInBy?.name || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

