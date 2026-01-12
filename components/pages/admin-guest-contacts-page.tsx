'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Mail, Phone, Calendar, Building2, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { GuestContactForm } from '@/components/forms/guest-contact-form'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'

const GuestContactType = {
  LEAD: 'LEAD',
  INQUIRY: 'INQUIRY',
  GUEST: 'GUEST',
} as const

const GuestContactStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  FOLLOW_UP: 'FOLLOW_UP',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const

export function AdminGuestContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)

  useEffect(() => {
    fetchContacts()
  }, [filterType, filterStatus, searchQuery])

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterType !== 'all') {
        params.append('type', filterType)
      }
      if (filterStatus !== 'all') {
        params.append('status', filterStatus)
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const res = await fetch(`/api/guest-contacts?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch guest contacts')
      }
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch guest contacts:', error)
      setContacts([])
      toast.error('Error', 'Failed to load guest contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this guest contact?')) return

    try {
      const res = await fetch(`/api/guest-contacts/${contactId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete guest contact')
      }
      toast.success('Deleted', 'Guest contact deleted successfully')
      fetchContacts()
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to delete guest contact')
    }
  }

  const handleConvertToBooking = (contact: any) => {
    router.push(`/admin/bookings/new?guestContactId=${contact.id}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800'
      case 'CONTACTED':
        return 'bg-yellow-100 text-yellow-800'
      case 'FOLLOW_UP':
        return 'bg-orange-100 text-orange-800'
      case 'CONVERTED':
        return 'bg-green-100 text-green-800'
      case 'LOST':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'LEAD':
        return 'bg-purple-100 text-purple-800'
      case 'INQUIRY':
        return 'bg-blue-100 text-blue-800'
      case 'GUEST':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Guest Contacts</h1>
          <p className="text-gray-500 mt-1">Manage leads, inquiries, and guest contacts</p>
        </div>
        <Button onClick={() => router.push('/admin/guest-contacts/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Guest Contact
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle>All Guest Contacts</CardTitle>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="INQUIRY">Inquiry</SelectItem>
                  <SelectItem value="GUEST">Guest</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="CONTACTED">Contacted</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="CONVERTED">Converted</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeletonLoader />
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No guest contacts found</p>
              <Button
                className="mt-4"
                onClick={() => router.push('/admin/guest-contacts/new')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add First Guest Contact
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Follow Up</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </div>
                          )}
                          {contact.phoneNumber && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {contact.phoneNumber}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(contact.type)}>
                          {contact.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(contact.status)}>
                          {contact.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contact.Property ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span className="text-sm">
                              {contact.Property.nickname || contact.Property.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.followUpDate ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(contact.followUpDate), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/guest-contacts/${contact.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {contact.status !== 'CONVERTED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConvertToBooking(contact)}
                              title="Convert to Booking"
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
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
