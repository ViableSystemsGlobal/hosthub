'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskType } from '@prisma/client'
import { toast } from '@/lib/toast'

export default function NewTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [formData, setFormData] = useState<{
    propertyId: string
    bookingId: string
    type: TaskType
    title: string
    description: string
    assignedToUserId: string
    scheduledAt: string
    dueAt: string
    costEstimate: number
  }>({
    propertyId: '',
    bookingId: '',
    type: TaskType.CLEANING,
    title: '',
    description: '',
    assignedToUserId: '',
    scheduledAt: '',
    dueAt: '',
    costEstimate: 0,
  })

  useEffect(() => {
    fetchProperties()
    fetchUsers()
  }, [])

  useEffect(() => {
    if (formData.propertyId) {
      fetchBookings(formData.propertyId)
    } else {
      setBookings([])
    }
  }, [formData.propertyId])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      setProperties(data)
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchBookings = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/bookings?propertyId=${propertyId}`)
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload: any = {
        propertyId: formData.propertyId,
        type: formData.type,
        title: formData.title,
        description: formData.description || undefined,
        scheduledAt: formData.scheduledAt || undefined,
        dueAt: formData.dueAt || undefined,
        costEstimate: formData.costEstimate || undefined,
      }

      if (formData.bookingId) {
        payload.bookingId = formData.bookingId
      }

      if (formData.assignedToUserId) {
        payload.assignedToUserId = formData.assignedToUserId
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create task')
      }

      toast.success('Task created', 'Task has been created successfully')
      router.push('/admin/tasks')
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
          <CardTitle>New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property *</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) =>
                  setFormData({ ...formData, propertyId: value, bookingId: '' })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.nickname || property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingId">Booking (Optional)</Label>
              <Select
                value={formData.bookingId || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, bookingId: value === 'none' ? '' : value })
                }
                disabled={!formData.propertyId || bookings.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {bookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.guestName || 'Guest'} - {new Date(booking.checkInDate).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as TaskType })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskType).map((type) => (
                      <SelectItem key={type} value={type as string}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedToUserId">Assign To</Label>
                <Select
                  value={formData.assignedToUserId || 'unassigned'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assignedToUserId: value === 'unassigned' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Scheduled At</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledAt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueAt">Due At</Label>
                <Input
                  id="dueAt"
                  type="datetime-local"
                  value={formData.dueAt}
                  onChange={(e) =>
                    setFormData({ ...formData, dueAt: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="costEstimate">Cost Estimate</Label>
              <Input
                id="costEstimate"
                type="number"
                step="0.01"
                value={formData.costEstimate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costEstimate: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Task'}
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

