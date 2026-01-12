'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingSource, BookingStatus, Currency } from '@prisma/client'
import { differenceInDays } from 'date-fns'
import { toast } from '@/lib/toast'
import { CheckInButton } from '@/components/ui/check-in-button'

interface BookingFormProps {
  bookingId?: string
  initialData?: any
}

export function BookingForm({ bookingId, initialData }: BookingFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isManager = pathname?.startsWith('/manager')
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [guestContacts, setGuestContacts] = useState<any[]>([])
  const [showGuestSelector, setShowGuestSelector] = useState(false)
  const [formData, setFormData] = useState({
    propertyId: initialData?.propertyId || '',
    source: initialData?.source || BookingSource.DIRECT,
    externalReservationCode: initialData?.externalReservationCode || '',
    guestName: initialData?.guestName || '',
    guestEmail: initialData?.guestEmail || '',
    guestPhoneNumber: initialData?.guestPhoneNumber || '',
    guestContactId: initialData?.guestContactId || '',
    checkInDate: initialData?.checkInDate
      ? new Date(initialData.checkInDate).toISOString().split('T')[0]
      : '',
    checkOutDate: initialData?.checkOutDate
      ? new Date(initialData.checkOutDate).toISOString().split('T')[0]
      : '',
    baseAmount: initialData?.baseAmount || 0,
    cleaningFee: initialData?.cleaningFee || 0,
    platformFees: initialData?.platformFees || 0,
    taxes: initialData?.taxes || 0,
    currency: initialData?.currency || Currency.GHS,
    fxRateToBase: initialData?.fxRateToBase || 1.0,
    paymentReceivedBy: initialData?.paymentReceivedBy || 'COMPANY',
    status: initialData?.status || BookingStatus.UPCOMING,
    autoCreateCleaningTask: true,
  })

  const [calculatedNights, setCalculatedNights] = useState(0)
  const [calculatedTotal, setCalculatedTotal] = useState(0)

  useEffect(() => {
    fetchProperties()
    if (!bookingId) {
      fetchGuestContacts()
      // Check for guestContactId in URL params
      const urlParams = new URLSearchParams(window.location.search)
      const guestContactIdParam = urlParams.get('guestContactId')
      if (guestContactIdParam) {
        handleGuestContactSelect(guestContactIdParam)
      }
    }
  }, [])

  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate) {
      const nights = differenceInDays(
        new Date(formData.checkOutDate),
        new Date(formData.checkInDate)
      )
      setCalculatedNights(nights > 0 ? nights : 0)
    }
  }, [formData.checkInDate, formData.checkOutDate])

  useEffect(() => {
    const total =
      formData.baseAmount +
      formData.cleaningFee -
      formData.platformFees -
      formData.taxes
    setCalculatedTotal(total)
  }, [
    formData.baseAmount,
    formData.cleaningFee,
    formData.platformFees,
    formData.taxes,
  ])

  const fetchProperties = async () => {
    try {
      const endpoint = isManager ? '/api/manager/properties' : '/api/properties'
      const res = await fetch(endpoint)
      const data = await res.json()
      setProperties(data)
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchGuestContacts = async () => {
    try {
      // Fetch all guest contacts (don't filter by status so we can see all guests)
      const res = await fetch('/api/guest-contacts')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        console.error('Failed to fetch guest contacts:', errorData.error || res.statusText)
        setGuestContacts([])
        return
      }
      const data = await res.json()
      console.log('Fetched guest contacts:', data)
      setGuestContacts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch guest contacts:', error)
      setGuestContacts([])
    }
  }

  const handleGuestContactSelect = async (contactId: string) => {
    // If contact is not in the list, fetch it
    let contact = guestContacts.find(c => c.id === contactId)
    if (!contact) {
      try {
        const res = await fetch(`/api/guest-contacts/${contactId}`)
        if (res.ok) {
          contact = await res.json()
        }
      } catch (error) {
        console.error('Failed to fetch guest contact:', error)
      }
    }
    
    if (contact) {
      setFormData({
        ...formData,
        guestContactId: contact.id,
        guestName: contact.name,
        guestEmail: contact.email || '',
        guestPhoneNumber: contact.phoneNumber || '',
      })
      setShowGuestSelector(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = bookingId
        ? `/api/bookings/${bookingId}`
        : '/api/bookings'
      const method = bookingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save booking')
      }

      toast.success(
        bookingId ? 'Booking updated' : 'Booking created',
        bookingId ? 'Booking has been updated successfully' : 'New booking has been added successfully'
      )
      const redirectPath = isManager ? '/manager/bookings' : '/admin/bookings'
      router.push(redirectPath)
      router.refresh()
    } catch (error: any) {
      toast.error('Error', error.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{bookingId ? 'Edit Booking' : 'New Booking'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property *</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) =>
                  setFormData({ ...formData, propertyId: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} - {property.Owner?.name || 'No owner'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source *</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData({ ...formData, source: value as BookingSource })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(BookingSource).map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="externalReservationCode">
                  External Reservation Code
                </Label>
                <Input
                  id="externalReservationCode"
                  value={formData.externalReservationCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      externalReservationCode: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentReceivedBy">Payment Received By *</Label>
              <Select
                value={formData.paymentReceivedBy}
                  onValueChange={(value) =>
                    setFormData({ ...formData, paymentReceivedBy: value as 'COMPANY' | 'OWNER' })
                  }
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPANY">
                    Company (We receive payment, payout owner)
                  </SelectItem>
                  <SelectItem value="OWNER">
                    Owner (Owner receives payment, invoice commission)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.paymentReceivedBy === 'COMPANY'
                  ? 'Payment comes to us. We will payout net amount to owner after deducting commission and expenses.'
                  : 'Payment goes directly to owner. We will invoice them for commission only.'}
              </p>
            </div>

            {!bookingId && (
              <div className="space-y-2">
                <Label>Select Existing Guest (Optional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.guestContactId}
                    onValueChange={handleGuestContactSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select existing guest..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(guestContacts) && guestContacts.length > 0 ? (
                        guestContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}{contact.email ? ` (${contact.email})` : ''}{contact.phoneNumber ? ` - ${contact.phoneNumber}` : ''}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-contacts" disabled>
                          {guestContacts === null || guestContacts === undefined 
                            ? 'Loading guest contacts...' 
                            : 'No guest contacts available'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.guestContactId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          guestContactId: '',
                          guestName: '',
                          guestEmail: '',
                          guestPhoneNumber: '',
                        })
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="guestName">Guest Name *</Label>
              <Input
                id="guestName"
                value={formData.guestName}
                onChange={(e) =>
                  setFormData({ ...formData, guestName: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Guest Email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, guestEmail: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestPhoneNumber">Guest Phone Number</Label>
                <Input
                  id="guestPhoneNumber"
                  type="tel"
                  value={formData.guestPhoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, guestPhoneNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-in Date *</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) =>
                    setFormData({ ...formData, checkInDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutDate">Check-out Date *</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) =>
                    setFormData({ ...formData, checkOutDate: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {calculatedNights > 0 && (
              <div className="text-sm text-gray-600">
                Nights: {calculatedNights}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseAmount">Base Amount *</Label>
                <Input
                  id="baseAmount"
                  type="number"
                  step="0.01"
                  value={formData.baseAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      baseAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      currency: value as Currency,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.GHS}>GHS</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cleaningFee">Cleaning Fee</Label>
                <Input
                  id="cleaningFee"
                  type="number"
                  step="0.01"
                  value={formData.cleaningFee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cleaningFee: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platformFees">Platform Fees</Label>
                <Input
                  id="platformFees"
                  type="number"
                  step="0.01"
                  value={formData.platformFees}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      platformFees: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxes">Taxes</Label>
                <Input
                  id="taxes"
                  type="number"
                  step="0.01"
                  value={formData.taxes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      taxes: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium">
                Total Payout: {calculatedTotal.toFixed(2)} {formData.currency}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as BookingStatus })
                }
                required
              >
                <SelectTrigger>
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
            </div>

            {!bookingId && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoCreateCleaningTask"
                  checked={formData.autoCreateCleaningTask}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      autoCreateCleaningTask: e.target.checked,
                    })
                  }
                />
                <Label htmlFor="autoCreateCleaningTask">
                  Auto-create cleaning task
                </Label>
              </div>
            )}

            {bookingId && initialData && (
              <div className="mt-4">
                <CheckInButton
                  bookingId={bookingId}
                  checkedInAt={initialData.checkedInAt}
                  checkedInBy={initialData.CheckedInBy}
                  checkInNotes={initialData.checkInNotes}
                  onCheckIn={() => {
                    // Refresh booking data
                    fetch(`/api/bookings/${bookingId}`)
                      .then((res) => res.json())
                      .then((data) => {
                        // Update form data with latest booking info
                        if (data) {
                          setFormData((prev) => ({
                            ...prev,
                            ...data,
                            checkInDate: data.checkInDate
                              ? new Date(data.checkInDate).toISOString().split('T')[0]
                              : prev.checkInDate,
                            checkOutDate: data.checkOutDate
                              ? new Date(data.checkOutDate).toISOString().split('T')[0]
                              : prev.checkOutDate,
                          }))
                        }
                      })
                  }}
                  disabled={formData.status !== BookingStatus.UPCOMING}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Booking'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

