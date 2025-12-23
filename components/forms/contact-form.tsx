'use client'

import { useState, useEffect } from 'react'
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
import { toast } from '@/lib/toast'
import { X } from 'lucide-react'

// ContactType enum values
const ContactType = {
  MAINTENANCE: 'MAINTENANCE',
  PLUMBING: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  CLEANING: 'CLEANING',
  HVAC: 'HVAC',
  GENERAL: 'GENERAL',
  OTHER: 'OTHER',
} as const

type ContactType = typeof ContactType[keyof typeof ContactType]

interface ContactFormProps {
  contactId?: string
  initialData?: any
  ownerId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function ContactForm({ contactId, initialData, ownerId: initialOwnerId, onSuccess, onCancel }: ContactFormProps) {
  const [loading, setLoading] = useState(false)
  const [owners, setOwners] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    phoneNumber: initialData?.phoneNumber || '',
    email: initialData?.email || '',
    type: initialData?.type || 'GENERAL',
    company: initialData?.company || '',
    notes: initialData?.notes || '',
    ownerId: initialData?.ownerId || initialOwnerId || '',
    isCompanyContact: initialData?.ownerId ? false : (initialOwnerId ? false : true),
  })

  useEffect(() => {
    if (!initialOwnerId) {
      fetchOwners()
    }
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        name: formData.name,
        phoneNumber: formData.phoneNumber,
        email: formData.email || null,
        type: formData.type,
        company: formData.company || null,
        notes: formData.notes || null,
        ownerId: formData.isCompanyContact ? null : (formData.ownerId || initialOwnerId || null),
      }

      if (contactId) {
        // Update existing contact
        const res = await fetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to update contact')
        }
      } else {
        // Create new contact
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to create contact')
        }
      }

      toast.success(
        contactId ? 'Contact updated' : 'Contact created',
        contactId ? 'Contact has been updated successfully' : 'New contact has been added successfully'
      )
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      toast.error('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="John Doe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number *</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          required
          placeholder="+1234567890"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
        />
      </div>

      {!initialOwnerId && (
        <div className="space-y-2">
          <Label>Contact Type</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="contactType"
                checked={formData.isCompanyContact}
                onChange={() => setFormData({ ...formData, isCompanyContact: true, ownerId: '' })}
                className="w-4 h-4"
              />
              <span>Company Contact (Available to all)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="contactType"
                checked={!formData.isCompanyContact}
                onChange={() => setFormData({ ...formData, isCompanyContact: false })}
                className="w-4 h-4"
              />
              <span>Owner Contact</span>
            </label>
          </div>
        </div>
      )}

      {!formData.isCompanyContact && !initialOwnerId && (
        <div className="space-y-2">
          <Label htmlFor="ownerId">Property Owner</Label>
          <Select
            value={formData.ownerId}
            onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="type">Service Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value })}
          required
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="PLUMBING">Plumbing</SelectItem>
            <SelectItem value="ELECTRICAL">Electrical</SelectItem>
            <SelectItem value="CLEANING">Cleaning</SelectItem>
            <SelectItem value="HVAC">HVAC</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          placeholder="ABC Maintenance Co."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional information..."
          rows={3}
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700">
          {loading ? 'Saving...' : contactId ? 'Update Contact' : 'Create Contact'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

