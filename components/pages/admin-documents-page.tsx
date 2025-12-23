'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { FileText, Download, Eye, Trash2, Search, Filter, CheckSquare, Square, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'

const DocumentType = {
  CONTRACT: 'CONTRACT',
  RECEIPT: 'RECEIPT',
  INVOICE: 'INVOICE',
  CERTIFICATE: 'CERTIFICATE',
  INSURANCE: 'INSURANCE',
  PHOTO: 'PHOTO',
  OTHER: 'OTHER',
} as const

interface Document {
  id: string
  type: string
  title: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  description: string | null
  createdAt: string
  Property?: { id: string; name: string } | null
  Owner?: { id: string; name: string } | null
  Booking?: { id: string; guestName: string | null } | null
  Expense?: { id: string; description: string } | null
  User?: { id: string; name: string | null; email: string } | null
}

export function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchDocuments()
    fetchProperties()
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDocuments()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [typeFilter, propertyFilter])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter)
      }

      const res = await fetch(`/api/documents?${params}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/auth/login'
          return
        }
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch documents' }))
        throw new Error(errorData.error || 'Failed to fetch documents')
      }
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch documents:', error)
      toast.error('Failed to fetch documents', error.message)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete document')
      }

      toast.success('Document deleted', 'Document has been deleted successfully')
      fetchDocuments()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error('Delete failed', error.message)
    }
  }

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(d => d.id)))
    }
  }

  const handleSelectDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocuments)
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId)
    } else {
      newSelected.add(documentId)
    }
    setSelectedDocuments(newSelected)
  }

  const handleBulkUpdateType = async (type: string) => {
    if (selectedDocuments.size === 0) return
    if (!confirm(`Update ${selectedDocuments.size} document(s) to type ${type}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedDocuments),
          action: 'updateType',
          data: { type },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update documents')
      }
      toast.success('Bulk update successful', `Updated ${selectedDocuments.size} document(s)`)
      setSelectedDocuments(new Set())
      fetchDocuments()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return
    if (!confirm(`Delete ${selectedDocuments.size} document(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedDocuments),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete documents')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedDocuments.size} document(s)`)
      setSelectedDocuments(new Set())
      fetchDocuments()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedDocuments.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedDocuments),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export documents')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `documents-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedDocuments.size} document(s)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      CONTRACT: 'bg-blue-100 text-blue-800',
      RECEIPT: 'bg-green-100 text-green-800',
      INVOICE: 'bg-purple-100 text-purple-800',
      CERTIFICATE: 'bg-yellow-100 text-yellow-800',
      INSURANCE: 'bg-red-100 text-red-800',
      PHOTO: 'bg-pink-100 text-pink-800',
      OTHER: 'bg-gray-100 text-gray-800',
    }
    return colors[type] || colors.OTHER
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      searchQuery === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.Property?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.Owner?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.Booking?.guestName?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  const getRelatedEntity = (doc: Document) => {
    if (doc.Property) {
      return (
        <Link
          href={`/admin/properties/${doc.Property.id}`}
          className="text-blue-600 hover:underline"
        >
          {doc.Property.name}
        </Link>
      )
    }
    if (doc.Owner) {
      return (
        <Link href={`/admin/owners/${doc.Owner.id}`} className="text-blue-600 hover:underline">
          Owner: {doc.Owner.name}
        </Link>
      )
    }
    if (doc.Booking) {
      return (
        <Link
          href={`/admin/bookings/${doc.Booking.id}`}
          className="text-blue-600 hover:underline"
        >
          Booking: {doc.Booking.guestName || 'Guest'}
        </Link>
      )
    }
    if (doc.Expense) {
      return (
        <Link
          href={`/admin/expenses/${doc.Expense.id}`}
          className="text-blue-600 hover:underline"
        >
          Expense: {doc.Expense.description}
        </Link>
      )
    }
    return <span className="text-gray-400">No relation</span>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <TableSkeletonLoader />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.values(DocumentType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No documents found"
          description={
            searchQuery || typeFilter !== 'all' || propertyFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload your first document to get started'
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                All Documents ({filteredDocuments.length})
              </CardTitle>
              {selectedDocuments.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedDocuments.size} selected
                  </span>
                  <Select
                    onValueChange={(value) => handleBulkUpdateType(value)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DocumentType).map((type) => (
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
                    onClick={() => setSelectedDocuments(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center"
                      >
                        {selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0 ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Related To</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <button
                          onClick={() => handleSelectDocument(doc.id)}
                          className="flex items-center justify-center"
                        >
                          {selectedDocuments.has(doc.id) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{doc.title}</div>
                          {doc.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {doc.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(doc.type)}>{doc.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {getRelatedEntity(doc)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 truncate max-w-xs">
                          {doc.fileName}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(doc.fileUrl, '_blank')}
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const link = document.createElement('a')
                              link.href = doc.fileUrl
                              link.download = doc.fileName
                              link.click()
                            }}
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(doc.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

