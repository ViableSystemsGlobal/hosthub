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
import { Button } from '@/components/ui/button'
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
import { Plus, Edit, Trash2, Phone, Building2, CheckSquare, Square, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ContactForm } from '@/components/forms/contact-form'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { toast } from '@/lib/toast'

export function AdminContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)

  useEffect(() => {
    fetchContacts()
  }, [filterType])

  useEffect(() => {
    // Refresh when page becomes visible (after returning from edit/create)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchContacts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      // Don't filter by companyOnly - show all contacts
      if (filterType !== 'all') {
        params.append('type', filterType)
      }

      const res = await fetch(`/api/contacts?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch contacts')
      }
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete contact')
      }

      toast.success('Contact deleted', 'Contact has been deleted successfully')
      fetchContacts()
    } catch (error: any) {
      toast.error('Delete failed', error.message)
    }
  }

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)))
    }
  }

  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId)
    } else {
      newSelected.add(contactId)
    }
    setSelectedContacts(newSelected)
  }

  const handleBulkUpdateType = async (type: string) => {
    if (selectedContacts.size === 0) return
    if (!confirm(`Update ${selectedContacts.size} contact(s) to type ${type}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedContacts),
          action: 'updateType',
          data: { type },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update contacts')
      }
      toast.success('Bulk update successful', `Updated ${selectedContacts.size} contact(s)`)
      setSelectedContacts(new Set())
      fetchContacts()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return
    if (!confirm(`Delete ${selectedContacts.size} contact(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedContacts),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete contacts')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedContacts.size} contact(s)`)
      setSelectedContacts(new Set())
      fetchContacts()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedContacts.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedContacts),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export contacts')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedContacts.size} contact(s)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleContactSuccess = () => {
    setShowContactDialog(false)
    setEditingContact(null)
    fetchContacts()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Contacts</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage all maintenance contacts (company and owner contacts)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingContact(null)
            setShowContactDialog(true)
          }}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Contact
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              All Contacts
            </CardTitle>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
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
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No contacts found</p>
            </div>
          ) : (
            <>
              {selectedContacts.size > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">
                    {selectedContacts.size} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={(value) => handleBulkUpdateType(value)}
                      disabled={bulkActionLoading}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Update Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ContactType).map((type) => (
                          <SelectItem key={type} value={type}>
                            Set to {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExport}
                      disabled={bulkActionLoading}
                    >
                      {bulkActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkActionLoading}
                      className="text-red-600 hover:text-red-700"
                    >
                      {bulkActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedContacts(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {selectedContacts.size === contacts.length && contacts.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <button
                        onClick={() => handleSelectContact(contact.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedContacts.has(contact.id) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.phoneNumber}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>{contact.company || '-'}</TableCell>
                    <TableCell>
                      {contact.Owner ? (
                        <div>
                          <div className="font-medium text-sm">{contact.Owner.name}</div>
                          {contact.Owner.Property && contact.Owner.Property.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {contact.Owner.Property.length} propert{contact.Owner.Property.length > 1 ? 'ies' : 'y'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Company
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{contact.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/admin/contacts/${contact.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingContact(contact)
                            setShowContactDialog(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(contact.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'New Contact'}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Update the contact information below.'
                : 'Add a new maintenance contact. You can assign it to a property owner or make it a company contact.'}
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            contactId={editingContact?.id}
            initialData={editingContact}
            onSuccess={handleContactSuccess}
            onCancel={() => {
              setShowContactDialog(false)
              setEditingContact(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

