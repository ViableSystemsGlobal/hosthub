'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, X, Download, Eye, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'

// Local constants for document types
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

interface DocumentManagerProps {
  propertyId?: string
  ownerId?: string
  bookingId?: string
  expenseId?: string
  title?: string
}

export function DocumentManager({
  propertyId,
  ownerId,
  bookingId,
  expenseId,
  title = 'Documents',
}: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    type: '',
    title: '',
    description: '',
    file: null as File | null,
  })

  useEffect(() => {
    fetchDocuments()
  }, [propertyId, ownerId, bookingId, expenseId])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (propertyId) params.append('propertyId', propertyId)
      if (ownerId) params.append('ownerId', ownerId)
      if (bookingId) params.append('bookingId', bookingId)
      if (expenseId) params.append('expenseId', expenseId)

      const res = await fetch(`/api/documents?${params}`)
      if (!res.ok) {
        let errorMessage = 'Failed to fetch documents'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = res.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch documents:', error)
      toast.error('Failed to fetch documents', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!formData.type || !formData.title || !formData.file) {
      toast.error('Validation error', 'Please fill in all required fields')
      return
    }

    try {
      setUploading(true)
      const uploadFormData = new FormData()
      if (propertyId) uploadFormData.append('propertyId', propertyId)
      if (ownerId) uploadFormData.append('ownerId', ownerId)
      if (bookingId) uploadFormData.append('bookingId', bookingId)
      if (expenseId) uploadFormData.append('expenseId', expenseId)
      uploadFormData.append('type', formData.type)
      uploadFormData.append('title', formData.title)
      if (formData.description) uploadFormData.append('description', formData.description)
      uploadFormData.append('file', formData.file)

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to upload document')
      }

      toast.success('Document uploaded', 'Document has been uploaded successfully')
      setUploadDialogOpen(false)
      setFormData({ type: '', title: '', description: '', file: null })
      fetchDocuments()
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Upload failed', error.message)
    } finally {
      setUploading(false)
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

  const isImage = (mimeType: string | null) => {
    return mimeType?.startsWith('image/') || false
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Document Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DocumentType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Property Contract 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">File *</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setFormData({ ...formData, file })
                      }
                    }}
                  />
                  {formData.file && (
                    <div className="text-sm text-gray-500">
                      Selected: {formData.file.name} ({formatFileSize(formData.file.size)})
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !formData.type || !formData.title || !formData.file}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No documents yet</p>
            <p className="text-sm mt-2">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    {isImage(doc.mimeType) ? (
                      <Eye className="w-5 h-5 text-gray-600" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                      <Badge className={getTypeColor(doc.type)}>{doc.type}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {doc.fileName} • {formatFileSize(doc.fileSize)} •{' '}
                      {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                    </div>
                    {doc.description && (
                      <div className="text-xs text-gray-400 mt-1 truncate">{doc.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

