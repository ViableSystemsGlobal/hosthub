'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/lib/toast'
import { Loader2 } from 'lucide-react'

interface GuestContactFormProps {
  contactId?: string
  initialData?: any
  onSuccess?: () => void
  onCancel?: () => void
  redirectPath?: string
}

export function GuestContactForm({
  contactId,
  initialData,
  onSuccess,
  onCancel,
  redirectPath,
}: GuestContactFormProps) {
  const router = useRouter()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isManager = pathname?.startsWith('/manager')
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phoneNumber: initialData?.phoneNumber || '',
    type: initialData?.type || 'LEAD',
    status: initialData?.status || 'NEW',
    source: initialData?.source || '',
    propertyId: initialData?.propertyId || '',
    notes: initialData?.notes || '',
    followUpDate: initialData?.followUpDate
      ? new Date(initialData.followUpDate).toISOString().split('T')[0]
      : '',
  })

  useEffect(() => {
    if (contactId && !initialData) {
      fetchContact()
    }
    fetchProperties()
  }, [contactId])

  const fetchContact = async () => {
    try {
      const res = await fetch(`/api/guest-contacts/${contactId}`)
      if (!res.ok) throw new Error('Failed to fetch guest contact')
      const data = await res.json()
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
        type: data.type || 'LEAD',
        status: data.status || 'NEW',
        source: data.source || '',
        propertyId: data.propertyId || '',
        notes: data.notes || '',
        followUpDate: data.followUpDate
          ? new Date(data.followUpDate).toISOString().split('T')[0]
          : '',
      })
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to load guest contact')
    }
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = contactId
        ? `/api/guest-contacts/${contactId}`
        : '/api/guest-contacts'
      const method = contactId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save guest contact')
      }

      toast.success(
        contactId ? 'Updated' : 'Created',
        contactId
          ? 'Guest contact updated successfully'
          : 'Guest contact created successfully'
      )

      if (onSuccess) {
        onSuccess()
      } else {
        const defaultRedirect = isManager ? '/manager/guest-contacts' : '/admin/guest-contacts'
        router.push(redirectPath || defaultRedirect)
        router.refresh()
      }
    } catch (error: any) {
      toast.error('Error', error.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            {contactId ? 'Edit Guest Contact' : 'New Guest Contact'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="INQUIRY">Inquiry</SelectItem>
                    <SelectItem value="GUEST">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="CONTACTED">Contacted</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                    <SelectItem value="CONVERTED">Converted</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData({ ...formData, source: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                    <SelectItem value="AIRBNB">Airbnb</SelectItem>
                    <SelectItem value="BOOKING_COM">Booking.com</SelectItem>
                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyId">Property (Optional)</Label>
              <Select
                value={formData.propertyId || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, propertyId: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} - {property.Owner?.name || 'No owner'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="followUpDate">Follow Up Date</Label>
              <Input
                id="followUpDate"
                type="date"
                value={formData.followUpDate}
                onChange={(e) =>
                  setFormData({ ...formData, followUpDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Guest Contact'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (onCancel) {
                    onCancel()
                  } else {
                    router.back()
                  }
                }}
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
