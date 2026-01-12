'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
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
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { Calendar, CalendarCheck, Plus, Edit, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { BookingStatus, Currency } from '@prisma/client'
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

interface Booking {
  id: string
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

export function ManagerBookingsPage() {
  const { data: session } = useSession()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null)
  const pageSize = 10

  // Check if user is General Manager (can edit/delete)
  const isGeneralManager = session?.user?.role === 'GENERAL_MANAGER'

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/manager/bookings')
      if (!res.ok) {
        throw new Error('Failed to fetch bookings')
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setBookings(data)
      } else {
        setBookings([])
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete booking')
      }
      toast.success('Booking deleted successfully')
      fetchBookings()
    } catch (error) {
      console.error('Failed to delete booking:', error)
      toast.error('Failed to delete booking')
    } finally {
      setDeleteDialogOpen(false)
      setBookingToDelete(null)
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
  const totalBookings = bookings.length
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED').length
  const upcomingBookings = bookings.filter(b => b.status === 'UPCOMING').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Link href="/manager/bookings/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bookings"
          value={totalBookings}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Completed"
          value={completedBookings}
          icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Upcoming"
          value={upcomingBookings}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="No bookings found"
          description="Bookings for your assigned properties will appear here."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                  {isGeneralManager && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.Property.name}
                    </TableCell>
                    <TableCell>{booking.Owner.name}</TableCell>
                    <TableCell>{booking.guestName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{booking.nights}</TableCell>
                    <TableCell>
                      {formatCurrency(booking.totalPayout, booking.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.status}</Badge>
                    </TableCell>
                    {isGeneralManager && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/manager/bookings/${booking.id}/edit`}>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setBookingToDelete(booking.id)
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
            {bookings.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(bookings.length / pageSize)}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                totalItems={bookings.length}
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
              This action cannot be undone. This will permanently delete the booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bookingToDelete && handleDelete(bookingToDelete)}
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

