'use client'

import { useEffect, useState, use } from 'react'
import { BookingForm } from '@/components/forms/booking-form'

export default function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setBooking(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div>Loading...</div>
  return <BookingForm bookingId={id} initialData={booking} />
}
