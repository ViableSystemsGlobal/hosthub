'use client'

import { useEffect, useState } from 'react'
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
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Eye,
  Loader2,
  FileText,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'

const TEMPLATE_TYPES = [
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'booking_reminder', label: 'Booking Reminder' },
  { value: 'statement', label: 'Statement' },
  { value: 'issue_notification', label: 'Issue Notification' },
  { value: 'payout_notification', label: 'Payout Notification' },
  { value: 'task_assignment', label: 'Task Assignment' },
  { value: 'general', label: 'General' },
] as const

const COMMON_VARIABLES = {
  booking_confirmation: [
    'guestName',
    'propertyName',
    'checkInDate',
    'checkOutDate',
    'nights',
    'totalPayout',
    'currency',
    'bookingId',
  ],
  booking_reminder: [
    'guestName',
    'propertyName',
    'checkInDate',
    'checkOutDate',
    'nights',
    'bookingId',
  ],
  statement: [
    'ownerName',
    'periodStart',
    'periodEnd',
    'totalRevenue',
    'totalExpenses',
    'commission',
    'netBalance',
    'currency',
  ],
  issue_notification: [
    'ownerName',
    'propertyName',
    'issueTitle',
    'issueDescription',
    'issueStatus',
    'issuePriority',
    'issueId',
  ],
  payout_notification: [
    'ownerName',
    'amount',
    'currency',
    'payoutDate',
    'payoutId',
  ],
  task_assignment: [
    'ownerName',
    'propertyName',
    'taskTitle',
    'taskDescription',
    'taskDueDate',
    'taskId',
  ],
  general: ['ownerName', 'propertyName'],
}

interface SMSTemplate {
  id: string
  name: string
  message: string
  type: string
  isDefault: boolean
  isActive: boolean
  variables: string[]
  createdAt: string
  updatedAt: string
}

export function AdminSMSTemplatesPage() {
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<SMSTemplate | null>(null)
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({})
  const [previewResult, setPreviewResult] = useState<{ message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    type: '',
    isDefault: false,
    isActive: true,
  })

  useEffect(() => {
    fetchTemplates()
  }, [typeFilter])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }

      const res = await fetch(`/api/sms-templates?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch templates' }))
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/auth/login'
          return
        }
        throw new Error(errorData.error || 'Failed to fetch templates')
      }
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch templates:', error)
      toast.error('Failed to fetch templates', error.message)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (template?: SMSTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        message: template.message,
        type: template.type,
        isDefault: template.isDefault,
        isActive: template.isActive,
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: '',
        message: '',
        type: '',
        isDefault: false,
        isActive: true,
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.message || !formData.type) {
      toast.error('Validation error', 'Please fill in all required fields')
      return
    }

    try {
      setSaving(true)
      const url = editingTemplate
        ? `/api/sms-templates/${editingTemplate.id}`
        : '/api/sms-templates'
      const method = editingTemplate ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          variables: COMMON_VARIABLES[formData.type as keyof typeof COMMON_VARIABLES] || [],
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save template')
      }

      toast.success('Template saved', 'SMS template has been saved successfully')
      setDialogOpen(false)
      fetchTemplates()
    } catch (error: any) {
      console.error('Failed to save template:', error)
      toast.error('Failed to save template', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const res = await fetch(`/api/sms-templates/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast.success('Template deleted', 'SMS template has been deleted successfully')
      fetchTemplates()
    } catch (error: any) {
      console.error('Failed to delete template:', error)
      toast.error('Failed to delete template', error.message)
    }
  }

  const handlePreview = async (template: SMSTemplate) => {
    setPreviewTemplate(template)
    const sampleVars: Record<string, string> = {}
    const vars = COMMON_VARIABLES[template.type as keyof typeof COMMON_VARIABLES] || []
    vars.forEach((varName) => {
      sampleVars[varName] = `[Sample ${varName}]`
    })
    setPreviewVariables(sampleVars)
    setPreviewDialogOpen(true)

    try {
      const res = await fetch(`/api/sms-templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: sampleVars }),
      })

      if (res.ok) {
        const data = await res.json()
        setPreviewResult(data)
      }
    } catch (error) {
      console.error('Failed to preview template:', error)
    }
  }

  const handleSelectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set())
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)))
    }
  }

  const handleSelectTemplate = (templateId: string) => {
    const newSelected = new Set(selectedTemplates)
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId)
    } else {
      newSelected.add(templateId)
    }
    setSelectedTemplates(newSelected)
  }

  const handleBulkUpdateActive = async (isActive: boolean) => {
    if (selectedTemplates.size === 0) return
    if (!confirm(`${isActive ? 'Activate' : 'Deactivate'} ${selectedTemplates.size} template(s)?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/sms-templates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedTemplates),
          action: 'updateActive',
          data: { isActive },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update templates')
      }
      toast.success('Bulk update successful', `Updated ${selectedTemplates.size} template(s)`)
      setSelectedTemplates(new Set())
      fetchTemplates()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedTemplates.size === 0) return
    if (!confirm(`Delete ${selectedTemplates.size} template(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/sms-templates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedTemplates),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete templates')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedTemplates.size} template(s)`)
      setSelectedTemplates(new Set())
      fetchTemplates()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedTemplates.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/sms-templates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedTemplates),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export templates')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sms-templates-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedTemplates.size} template(s)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-message') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      const before = text.substring(0, start)
      const after = text.substring(end)
      const variableText = `{{${variable}}}`
      textarea.value = before + variableText + after
      textarea.focus()
      textarea.setSelectionRange(start + variableText.length, start + variableText.length)
      setFormData({ ...formData, message: textarea.value })
    }
  }

  const filteredTemplates = templates.filter((t) => {
    if (typeFilter === 'all') return true
    return t.type === typeFilter
  })

  const getTypeLabel = (type: string) => {
    return TEMPLATE_TYPES.find((t) => t.value === type)?.label || type
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS Templates</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage SMS message templates for notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const res = await fetch('/api/sms-templates/seed', { method: 'POST' })
                const data = await res.json()
                if (res.ok) {
                  toast.success('Templates seeded', data.message || 'Default templates created')
                  fetchTemplates()
                } else {
                  throw new Error(data.error || 'Failed to seed templates')
                }
              } catch (error: any) {
                toast.error('Failed to seed templates', error.message)
              }
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Seed Defaults
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TEMPLATE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      {filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-12 h-12" />}
          title="No SMS templates"
          description="Create your first SMS template to get started"
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Templates ({filteredTemplates.length})</CardTitle>
              {selectedTemplates.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedTemplates.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkUpdateActive(true)}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Activate'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkUpdateActive(false)}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Deactivate'
                    )}
                  </Button>
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
                    onClick={() => setSelectedTemplates(new Set())}
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
                        {selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0 ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <button
                          onClick={() => handleSelectTemplate(template.id)}
                          className="flex items-center justify-center"
                        >
                          {selectedTemplates.has(template.id) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{template.name}</div>
                        {template.isDefault && (
                          <Badge className="mt-1 bg-blue-100 text-blue-800">
                            Default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(template.type)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{template.message}</TableCell>
                      <TableCell>
                        {template.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(template.updatedAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(template)}
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(template)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(template.id)}
                            title="Delete"
                            disabled={template.isDefault}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Booking Confirmation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Template Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="template-message">SMS Message *</Label>
                {formData.type && (
                  <div className="flex gap-2 flex-wrap">
                    {COMMON_VARIABLES[formData.type as keyof typeof COMMON_VARIABLES]?.map(
                      (variable) => (
                        <Button
                          key={variable}
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(variable)}
                          className="text-xs"
                        >
                          {variable}
                        </Button>
                      )
                    )}
                  </div>
                )}
              </div>
              <textarea
                id="template-message"
                className="w-full min-h-[200px] p-3 border rounded-md font-mono text-sm"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter SMS message. Use {{variableName}} for dynamic content. Keep it concise (SMS has character limits)."
              />
              <p className="text-xs text-gray-500">
                Use {'{{variableName}}'} to insert dynamic values. SMS messages should be concise.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span className="text-sm">Set as default for this type</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span className="text-sm">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Template'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewResult && (
            <div className="space-y-4">
              <div>
                <Label>Message:</Label>
                <div className="p-3 bg-gray-50 rounded-md whitespace-pre-wrap font-mono text-sm">
                  {previewResult.message}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Character count: {previewResult.message.length} (SMS limit: ~160 characters per message)
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
