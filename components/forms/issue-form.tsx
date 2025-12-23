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
import { toast } from '@/lib/toast'
import { X, Upload, Image as ImageIcon, Video } from 'lucide-react'

interface IssueFormProps {
  issueId?: string
  initialData?: any
  propertyId?: string
}

export function IssueForm({ issueId, initialData, propertyId: initialPropertyId }: IssueFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<Array<{ url: string; type: string; name: string }>>([])
  const [formData, setFormData] = useState({
    propertyId: initialPropertyId || '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    assignedToUserId: '',
    assignedContactId: '',
  })

  useEffect(() => {
    fetchProperties()
    fetchUsers()
    fetchContacts()
  }, [])

  useEffect(() => {
    if (formData.propertyId) {
      fetchContactsForProperty()
    }
  }, [formData.propertyId])

  useEffect(() => {
    if (initialData) {
      setFormData({
        propertyId: initialData.propertyId || '',
        title: initialData.title || '',
        description: initialData.description || '',
        priority: initialData.priority || 'MEDIUM',
        assignedToUserId: initialData.assignedToUserId || '',
        assignedContactId: initialData.assignedContactId || '',
      })
    }
  }, [initialData])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(data)
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        // Filter for managers and admins
        const assignableUsers = data.filter((u: any) =>
          ['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'OPERATIONS'].includes(u.role)
        )
        setUsers(assignableUsers)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts')
      if (res.ok) {
        const data = await res.json()
        setContacts(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }

  const fetchContactsForProperty = async () => {
    try {
      // Fetch company contacts and owner contacts for this property
      const [companyRes, propertyRes] = await Promise.all([
        fetch('/api/contacts?companyOnly=true'),
        fetch(`/api/properties/${formData.propertyId}`),
      ])

      if (propertyRes.ok) {
        const property = await propertyRes.json()
        const ownerId = property.ownerId

        if (ownerId) {
          const ownerContactsRes = await fetch(`/api/contacts?ownerId=${ownerId}`)
          if (ownerContactsRes.ok) {
            const ownerContacts = await ownerContactsRes.json()
            const companyContacts = companyRes.ok ? await companyRes.json() : []
            setContacts([...companyContacts, ...ownerContacts])
          }
        } else if (companyRes.ok) {
          const companyContacts = await companyRes.json()
          setContacts(companyContacts)
        }
      }
    } catch (error) {
      console.error('Failed to fetch contacts for property:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const newFiles = [...files, ...selectedFiles]
    setFiles(newFiles)

    // Create previews
    const newPreviews = selectedFiles.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name,
    }))
    setPreviews([...previews, ...newPreviews])
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setFiles(newFiles)
    setPreviews(newPreviews)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('propertyId', formData.propertyId)
      formDataToSend.append('title', formData.title)
      if (formData.description) {
        formDataToSend.append('description', formData.description)
      }
      formDataToSend.append('priority', formData.priority)
      if (formData.assignedToUserId) {
        formDataToSend.append('assignedToUserId', formData.assignedToUserId)
      }
      if (formData.assignedContactId) {
        formDataToSend.append('assignedContactId', formData.assignedContactId)
      }

      // Add files
      files.forEach((file) => {
        formDataToSend.append('files', file)
      })

      if (issueId) {
        // Update existing issue
        const res = await fetch(`/api/issues/${issueId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            assignedToUserId: formData.assignedToUserId || null,
            assignedContactId: formData.assignedContactId || null,
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to update issue')
        }

        // Add new attachments if any
        if (files.length > 0) {
          const attachmentFormData = new FormData()
          files.forEach((file) => {
            attachmentFormData.append('files', file)
          })

          const attachRes = await fetch(`/api/issues/${issueId}/attachments`, {
            method: 'POST',
            body: attachmentFormData,
          })

          if (!attachRes.ok) {
            throw new Error('Failed to add attachments')
          }
        }
      } else {
        // Create new issue
        const res = await fetch('/api/issues', {
          method: 'POST',
          body: formDataToSend,
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to create issue')
        }
      }

      toast.success(
        issueId ? 'Issue updated' : 'Issue created',
        issueId ? 'Issue has been updated successfully' : 'New issue has been created successfully'
      )
      
      // Determine redirect path based on current route
      const path = window.location.pathname
      if (path.includes('/admin/')) {
        router.push('/admin/issues')
      } else if (path.includes('/manager/')) {
        router.push('/manager/issues')
      } else if (path.includes('/owner/')) {
        router.push('/owner/issues')
      } else {
        router.push('/admin/issues')
      }
      router.refresh()
    } catch (error: any) {
      toast.error('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="propertyId">Property *</Label>
        <Select
          value={formData.propertyId}
          onValueChange={(value) => setFormData({ ...formData, propertyId: value })}
          required
          disabled={!!initialPropertyId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a property" />
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
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="e.g., Leaky faucet in bathroom"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the issue in detail..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">Priority *</Label>
        <Select
          value={formData.priority}
          onValueChange={(value) => setFormData({ ...formData, priority: value as IssuePriority })}
          required
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedContactId">Maintenance Person *</Label>
        <Select
          value={formData.assignedContactId}
          onValueChange={(value) =>
            setFormData({ ...formData, assignedContactId: value === 'none' ? '' : value })
          }
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select maintenance person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.name} {contact.company ? `(${contact.company})` : ''} - {contact.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.propertyId && contacts.length === 0 && (
          <p className="text-xs text-gray-500">Select a property first to see available contacts</p>
        )}
      </div>

      {issueId && (
        <div className="space-y-2">
          <Label htmlFor="assignedToUserId">Assign To User</Label>
          <Select
            value={formData.assignedToUserId}
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
      )}

      <div className="space-y-2">
        <Label htmlFor="files">Attachments (Images/Videos)</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <input
            type="file"
            id="files"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="files"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">
              Click to upload images or videos
            </span>
            <span className="text-xs text-gray-400 mt-1">
              Supports multiple files
            </span>
          </label>
        </div>

        {previews.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                {preview.type === 'video' ? (
                  <video
                    src={preview.url}
                    className="w-full h-32 object-cover rounded-lg"
                    controls
                  />
                ) : (
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {preview.type === 'video' ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <ImageIcon className="w-3 h-3" />
                  )}
                  <span className="truncate max-w-[100px]">{preview.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700">
          {loading ? 'Saving...' : issueId ? 'Update Issue' : 'Create Issue'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

