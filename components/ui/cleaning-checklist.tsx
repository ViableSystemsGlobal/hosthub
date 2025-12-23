'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Image as ImageIcon, Upload, X } from 'lucide-react'
import { toast } from '@/lib/toast'

interface CleaningChecklistProps {
  taskId: string
  propertyId: string
  canEdit?: boolean
}

export function CleaningChecklist({
  taskId,
  propertyId,
  canEdit = false,
}: CleaningChecklistProps) {
  const [checklist, setChecklist] = useState<any>(null)
  const [checklists, setChecklists] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectDialogOpen, setSelectDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchChecklist()
    fetchAttachments()
    if (!checklist) {
      fetchAvailableChecklists()
    }
  }, [taskId])

  const fetchChecklist = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`)
      if (res.ok) {
        const data = await res.json()
        setChecklist(data)
      }
    } catch (error) {
      console.error('Failed to fetch checklist:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`)
      if (res.ok) {
        const data = await res.json()
        setAttachments(data)
      }
    } catch (error) {
      console.error('Failed to fetch attachments:', error)
    }
  }

  const fetchAvailableChecklists = async () => {
    try {
      const res = await fetch(`/api/cleaning-checklists?propertyId=${propertyId}`)
      if (res.ok) {
        const data = await res.json()
        setChecklists(data.filter((c: any) => c.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch checklists:', error)
    }
  }

  const handleSelectChecklist = async (checklistId: string) => {
    try {
      const selectedChecklist = checklists.find((c) => c.id === checklistId)
      if (!selectedChecklist) return

      const items = (selectedChecklist.items as any[]).map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        text: item.text,
        completed: false,
      }))

      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistId,
          items,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign checklist')
      }

      const data = await res.json()
      setChecklist(data)
      setSelectDialogOpen(false)
      toast.success('Checklist assigned successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign checklist')
    }
  }

  const handleToggleItem = async (itemId: string) => {
    if (!checklist) return

    const items = (checklist.items as any[]).map((item: any) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? new Date().toISOString() : null,
            completedById: !item.completed ? 'current-user' : null,
          }
        : item
    )

    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update checklist')
      }

      const data = await res.json()
      setChecklist(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update checklist')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    Array.from(files).forEach((file) => {
      formData.append('files', file)
    })

    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to upload photos')
      }

      toast.success('Photos uploaded successfully')
      fetchAttachments()
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photos')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleMarkReady = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/mark-ready`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to mark as ready')
      }

      toast.success('Task marked as ready for guest')
      fetchChecklist()
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark as ready')
    }
  }

  const items = checklist?.items || []
  const allCompleted = items.length > 0 && items.every((item: any) => item.completed)
  const isReady = checklist?.completedAt !== null

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading checklist...</div>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cleaning Checklist</CardTitle>
        {canEdit && !checklist && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectDialogOpen(true)}
          >
            Assign Checklist
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!checklist ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No checklist assigned yet
            </p>
            {canEdit && (
              <Button onClick={() => setSelectDialogOpen(true)}>
                Assign Checklist
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center space-x-2 p-2 rounded border"
                >
                  <Checkbox
                    id={item.id}
                    checked={item.completed}
                    onCheckedChange={() => canEdit && handleToggleItem(item.id)}
                    disabled={!canEdit || isReady}
                  />
                  <Label
                    htmlFor={item.id}
                    className={`flex-1 cursor-pointer ${
                      item.completed ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.text}
                  </Label>
                  {item.completed && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
              ))}
            </div>

            {allCompleted && !isReady && canEdit && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900 mb-2">
                  All checklist items completed!
                </p>
                <Button onClick={handleMarkReady} size="sm">
                  Mark as Ready for Guest
                </Button>
              </div>
            )}

            {isReady && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Ready for Guest
                  </p>
                  <p className="text-xs text-blue-700">
                    Completed on{' '}
                    {new Date(checklist.completedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Photo Upload Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Photos</Label>
                {canEdit && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Photos'}
                    </Button>
                  </label>
                )}
              </div>
              {attachments.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative aspect-square rounded-lg overflow-hidden border"
                    >
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No photos uploaded yet
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Select Checklist Dialog */}
      <Dialog open={selectDialogOpen} onOpenChange={setSelectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Cleaning Checklist</DialogTitle>
            <DialogDescription>
              Choose a checklist template to assign to this task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {checklists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No checklists available. Create one in settings first.
              </p>
            ) : (
              checklists.map((cl) => (
                <button
                  key={cl.id}
                  onClick={() => handleSelectChecklist(cl.id)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="font-medium">{cl.name}</div>
                  {cl.Property && (
                    <div className="text-xs text-muted-foreground">
                      {cl.Property.name}
                    </div>
                  )}
                  {cl.isDefault && (
                    <Badge variant="secondary" className="mt-1">
                      Default
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

