'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2, User, DollarSign, CalendarCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { BookingStatus, Currency } from '@prisma/client'
import Link from 'next/link'

interface Booking {
  id: string
  guestName?: string | null
  checkInDate: string
  checkOutDate: string
  nights: number
  totalPayout: number
  currency: Currency
  status: BookingStatus
  Property: {
    id: string
    name: string
  }
  Owner: {
    id: string
    name: string
  }
}

interface Property {
  id: string
  name: string
}

interface Owner {
  id: string
  name: string
}

export function AdminBookingsCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [selectedOwner, setSelectedOwner] = useState<string>('all')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
    fetchOwners()
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [currentDate, selectedProperty, selectedOwner])

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

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      if (res.ok) {
        const data = await res.json()
        setOwners(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      
      const params = new URLSearchParams()
      params.append('startDate', monthStart.toISOString())
      params.append('endDate', monthEnd.toISOString())
      if (selectedProperty !== 'all') params.append('propertyId', selectedProperty)
      if (selectedOwner !== 'all') params.append('ownerId', selectedOwner)

      const res = await fetch(`/api/bookings?${params}`)
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

  const getBookingsForDate = (date: Date): Booking[] => {
    return bookings.filter((booking) => {
      const checkIn = new Date(booking.checkInDate)
      const checkOut = new Date(booking.checkOutDate)
      return (
        isSameDay(checkIn, date) ||
        isSameDay(checkOut, date) ||
        (date >= checkIn && date <= checkOut)
      )
    })
  }

  const getStatusColor = (status: BookingStatus): string => {
    switch (status) {
      case 'UPCOMING':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'CHECKED_IN':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings Calendar</h1>
          <p className="text-gray-600 mt-1">View all bookings in a calendar view</p>
        </div>
        <Link href="/admin/bookings">
          <Button variant="outline">
            <CalendarIcon className="w-4 h-4 mr-2" />
            List View
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold min-w-[200px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-gray-500">Loading calendar...</div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Week day headers */}
              {weekDays.map((day) => (
                <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendarDays.map((day, idx) => {
                const dayBookings = getBookingsForDate(day)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isCurrentDay = isToday(day)

                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] p-1 border border-gray-200 ${
                      !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                    } ${isCurrentDay ? 'ring-2 ring-orange-500' : ''}`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        !isCurrentMonth ? 'text-gray-400' : isCurrentDay ? 'text-orange-600' : 'text-gray-900'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayBookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`text-xs p-1 rounded cursor-pointer border truncate ${getStatusColor(booking.status)}`}
                          title={`${booking.Property.name} - ${booking.guestName || 'Guest'}`}
                        >
                          <div className="font-medium truncate">
                            {booking.Property.name}
                          </div>
                          {isSameDay(new Date(booking.checkInDate), day) && (
                            <div className="text-[10px] opacity-75">Check-in</div>
                          )}
                          {isSameDay(new Date(booking.checkOutDate), day) && (
                            <div className="text-[10px] opacity-75">Check-out</div>
                          )}
                        </div>
                      ))}
                      {dayBookings.length > 3 && (
                        <div className="text-xs text-gray-500 p-1">
                          +{dayBookings.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Property</div>
                  <div className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {selectedBooking.Property.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Owner</div>
                  <div className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {selectedBooking.Owner.name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Guest Name</div>
                  <div className="font-medium">
                    {selectedBooking.guestName || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <Badge className={getStatusColor(selectedBooking.status)}>
                    {selectedBooking.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Check-in</div>
                  <div className="font-medium flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4" />
                    {format(new Date(selectedBooking.checkInDate), 'MMM d, yyyy')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Check-out</div>
                  <div className="font-medium flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4" />
                    {format(new Date(selectedBooking.checkOutDate), 'MMM d, yyyy')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Nights</div>
                  <div className="font-medium">{selectedBooking.nights}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Payout</div>
                  <div className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    {formatCurrency(selectedBooking.totalPayout, selectedBooking.currency)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Link href={`/admin/bookings/${selectedBooking.id}/edit`} className="flex-1">
                  <Button className="w-full">Edit Booking</Button>
                </Link>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedBooking(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

