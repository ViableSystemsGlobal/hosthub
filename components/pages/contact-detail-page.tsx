'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { ArrowLeft, Edit, Phone, Mail, Building2, User, Calendar } from 'lucide-react'
import Link from 'next/link'
import { ContactForm } from '@/components/forms/contact-form'
// IssueStatus and IssuePriority enums - using string literals for compatibility
const IssueStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const

const IssuePriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

type IssueStatus = typeof IssueStatus[keyof typeof IssueStatus]
type IssuePriority = typeof IssuePriority[keyof typeof IssuePriority]

interface ContactDetailPageProps {
  contactId: string
}

export function ContactDetailPage({ contactId }: ContactDetailPageProps) {
  const router = useRouter()
  const [contact, setContact] = useState<any>(null)
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (contactId) {
      fetchContact()
      fetchIssues()
    }
  }, [contactId])

  const fetchContact = async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch contact')
      }
      const data = await res.json()
      setContact(data)
    } catch (error) {
      console.error('Failed to fetch contact:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchIssues = async () => {
    try {
      const res = await fetch('/api/issues')
      if (!res.ok) return
      const data = await res.json()
      // Filter issues assigned to this contact
      const assignedIssues = Array.isArray(data)
        ? data.filter((issue: any) => issue.assignedContactId === contactId)
        : []
      setIssues(assignedIssues)
    } catch (error) {
      console.error('Failed to fetch issues:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'LOW':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Contact not found</p>
          <Button onClick={() => router.push('/admin/contacts')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Contact</h1>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ContactForm
              contactId={contactId}
              initialData={contact}
              ownerId={contact.ownerId}
              onSuccess={() => {
                setEditing(false)
                fetchContact()
              }}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/admin/contacts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{contact.name}</h1>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-600">Name</div>
              <div className="font-medium">{contact.name}</div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Phone Number</div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a
                  href={`tel:${contact.phoneNumber}`}
                  className="text-orange-600 hover:underline"
                >
                  {contact.phoneNumber}
                </a>
              </div>
            </div>

            {contact.email && (
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-orange-600 hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
              </div>
            )}

            <div>
              <div className="text-sm text-gray-600">Service Type</div>
              <Badge variant="outline">{contact.type}</Badge>
            </div>

            {contact.company && (
              <div>
                <div className="text-sm text-gray-600">Company</div>
                <div className="font-medium">{contact.company}</div>
              </div>
            )}

            {contact.Owner ? (
              <div>
                <div className="text-sm text-gray-600">Owner</div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>{contact.Owner.name}</span>
                </div>
                {contact.Owner.Property && contact.Owner.Property.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-600">Properties</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {contact.Owner.Property.map((property: any) => (
                        <Badge key={property.id} variant="outline" className="text-xs">
                          {property.nickname || property.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="text-sm text-gray-600">Type</div>
                <Badge className="bg-blue-100 text-blue-800">Company Contact</Badge>
                <p className="text-xs text-gray-500 mt-1">Available to all properties</p>
              </div>
            )}

            {contact.notes && (
              <div>
                <div className="text-sm text-gray-600">Notes</div>
                <div className="mt-1">{contact.notes}</div>
              </div>
            )}

            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{format(new Date(contact.createdAt), 'MMM dd, yyyy')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue History ({issues.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No issues assigned to this contact</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/issues/${issue.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{issue.title}</span>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(issue.priority)}>
                          {issue.priority}
                        </Badge>
                        <Badge className={getStatusColor(issue.status)}>
                          {issue.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {issue.Property?.nickname || issue.Property?.name || 'Unknown Property'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(issue.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

