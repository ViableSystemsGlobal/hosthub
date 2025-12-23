'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Phone, Search, X, Building2, User } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ContactTypes = ['MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANING', 'HVAC', 'GENERAL', 'OTHER'] as const

interface Contact {
  id: string
  name: string
  phoneNumber: string
  email?: string
  type: string
  company?: string
  ownerId?: string
  Owner?: {
    id: string
    name: string
    email: string
    Property?: Array<{
      id: string
      name: string
      nickname?: string
    }>
  }
}

export function ContactsSidebar() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchContacts()
  }, [filterType])

  const fetchContacts = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') {
        params.append('type', filterType)
      }

      const res = await fetch(`/api/contacts?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phoneNumber.includes(searchTerm) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-20 md:bottom-6 z-40 rounded-full w-14 h-14 shadow-lg hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--theme-color, #f97316)' }}
        size="icon"
      >
        <Phone className="w-6 h-6" />
      </Button>
    )
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l border-gray-200 z-50 shadow-xl flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5" style={{ color: 'var(--theme-color, #f97316)' }} />
          <h2 className="font-semibold">All Contacts</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ContactTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Phone className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No contacts found</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {contact.name}
                      <Badge variant="outline" className="text-xs">
                        {contact.type}
                      </Badge>
                    </CardTitle>
                    {contact.company && (
                      <p className="text-sm text-gray-600 mt-1">{contact.company}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Phone:</span>{' '}
                  <a
                    href={`tel:${contact.phoneNumber}`}
                    className="text-orange-600 hover:underline"
                  >
                    {contact.phoneNumber}
                  </a>
                </div>
                {contact.email && (
                  <div className="text-sm">
                    <span className="font-medium">Email:</span>{' '}
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-orange-600 hover:underline"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}

                {contact.ownerId && contact.Owner ? (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <User className="w-4 h-4" />
                      <span className="font-medium">Owner:</span>
                      <span>{contact.Owner.name}</span>
                    </div>
                    {contact.Owner.Property && contact.Owner.Property.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building2 className="w-4 h-4" />
                          <span className="font-medium">Properties:</span>
                        </div>
                        <div className="pl-6 space-y-1">
                          {contact.Owner.Property.map((property) => (
                            <div key={property.id} className="text-xs text-gray-500">
                              • {property.nickname || property.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">Company Contact</span>
                      <Badge variant="outline" className="text-xs bg-blue-50">
                        Available to all
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

