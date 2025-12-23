'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, Sparkles, Search, Building2, Calendar, Image as ImageIcon, Upload, X, CheckSquare, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { EmptyState } from '@/components/ui/empty-state'
import Link from 'next/link'
import { TaskStatus, TaskType } from '@prisma/client'

interface Task {
  id: string
  title: string
  status: TaskStatus
  scheduledAt?: string | null
  dueAt?: string | null
  checklistCompletedAt?: string | null
  isReadyForGuest?: boolean | null
  Property: {
    id: string
    name: string
    nickname?: string | null
  }
  TaskChecklist?: {
    id: string
    items: any[]
    completedAt?: string | null
  } | null
  TaskAttachment?: Array<{
    id: string
    fileUrl: string
    fileName: string
  }>
}

export function AdminCleaningTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false)
  const [markReadyDialogOpen, setMarkReadyDialogOpen] = useState(false)
  const [taskToMarkReady, setTaskToMarkReady] = useState<Task | null>(null)
  const [markingReady, setMarkingReady] = useState(false)
  const [checklistItems, setChecklistItems] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [properties, setProperties] = useState<any[]>([])

  useEffect(() => {
    fetchTasks()
    fetchProperties()
  }, [statusFilter, propertyFilter])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('type', TaskType.CLEANING)
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter)
      }

      const res = await fetch(`/api/tasks?${params.toString()}`, {
        credentials: 'include',
      })

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch tasks' }))
        throw new Error(errorData.error || 'Failed to fetch tasks')
      }

      const data = await res.json()
      const tasksList = Array.isArray(data) ? data : []
      
      // Fetch checklist and attachments for each task
      const tasksWithDetails = await Promise.all(
        tasksList.map(async (task: Task) => {
          try {
            const [checklistRes, attachmentsRes] = await Promise.all([
              fetch(`/api/tasks/${task.id}/checklist`, { credentials: 'include' }),
              fetch(`/api/tasks/${task.id}/attachments`, { credentials: 'include' }),
            ])

            const checklist = checklistRes.ok ? await checklistRes.json() : null
            const attachments = attachmentsRes.ok ? await attachmentsRes.json() : []

            return {
              ...task,
              TaskChecklist: checklist,
              TaskAttachment: attachments,
            }
          } catch (error) {
            console.error(`Failed to fetch details for task ${task.id}:`, error)
            return task
          }
        })
      )

      setTasks(tasksWithDetails)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      setTasks([])
      toast.error('Failed to load cleaning tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChecklist = async (task: Task) => {
    setSelectedTask(task)
    setAttachments(task.TaskAttachment || [])
    
    // If task has a checklist, use it
    if (task.TaskChecklist && task.TaskChecklist.items) {
      setChecklistItems(task.TaskChecklist.items as any[])
    } else {
      // Try to fetch a default checklist template for this property
      try {
        const res = await fetch(
          `/api/cleaning-checklists?propertyId=${task.Property.id}&includeGlobal=true`,
          { credentials: 'include' }
        )
        if (res.ok) {
          const checklists = await res.json()
          const defaultChecklist = checklists.find(
            (c: any) => c.isDefault && c.isActive
          ) || checklists.find((c: any) => c.isActive)
          
          if (defaultChecklist && defaultChecklist.items) {
            // Convert template items to checklist items format
            const items = (defaultChecklist.items as any[]).map((item: any) => ({
              id: item.id || crypto.randomUUID(),
              text: item.text || item,
              completed: false,
            }))
            setChecklistItems(items)
          } else {
            setChecklistItems([])
          }
        } else {
          setChecklistItems([])
        }
      } catch (error) {
        console.error('Failed to fetch default checklist:', error)
        setChecklistItems([])
      }
    }
    
    setChecklistDialogOpen(true)
  }

  const handleChecklistItemToggle = (index: number) => {
    const updated = [...checklistItems]
    updated[index] = {
      ...updated[index],
      completed: !updated[index].completed,
    }
    setChecklistItems(updated)
  }

  const handleSaveChecklist = async () => {
    if (!selectedTask) return

    setSubmitting(true)
    try {
      // If no checklist exists, we need to find a checklist template to use
      let checklistId = selectedTask.TaskChecklist?.id ? 
        (selectedTask.TaskChecklist as any).checklistId : null

      // If no checklistId, try to find a default one
      if (!checklistId && checklistItems.length > 0) {
        try {
          const res = await fetch(
            `/api/cleaning-checklists?propertyId=${selectedTask.Property.id}&includeGlobal=true`,
            { credentials: 'include' }
          )
          if (res.ok) {
            const checklists = await res.json()
            const defaultChecklist = checklists.find(
              (c: any) => c.isDefault && c.isActive
            ) || checklists.find((c: any) => c.isActive)
            
            if (defaultChecklist) {
              checklistId = defaultChecklist.id
            }
          }
        } catch (error) {
          console.error('Failed to fetch checklist template:', error)
        }
      }

      const res = await fetch(`/api/tasks/${selectedTask.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: checklistItems,
          checklistId: checklistId,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update checklist')
      }

      toast.success('Checklist updated')
      fetchTasks()
      setChecklistDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update checklist')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkReady = (task: Task) => {
    setTaskToMarkReady(task)
    setMarkReadyDialogOpen(true)
  }

  const confirmMarkReady = async () => {
    if (!taskToMarkReady || markingReady) return

    setMarkingReady(true)
    try {
      const res = await fetch(`/api/tasks/${taskToMarkReady.id}/mark-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to mark as ready' }))
        throw new Error(error.error || 'Failed to mark as ready')
      }

      const updatedTask = await res.json()
      toast.success('Task marked as cleaned and ready')
      setMarkReadyDialogOpen(false)
      setTaskToMarkReady(null)
      fetchTasks() // Refresh the tasks list
    } catch (error: any) {
      console.error('Failed to mark task as ready:', error)
      toast.error(error.message || 'Failed to mark as ready')
    } finally {
      setMarkingReady(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTask || !e.target.files?.length) return

    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('files', file)

    setUploading(true)
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to upload photo')
      }

      const updatedTask = await res.json()
      // Refresh attachments from the updated task
      if (updatedTask.TaskAttachment) {
        setAttachments(updatedTask.TaskAttachment)
      }
      toast.success('Photo uploaded successfully')
      e.target.value = '' // Reset input
      fetchTasks() // Refresh the main list
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedTask) return
    if (!confirm('Delete this photo?')) return

    try {
      const res = await fetch(
        `/api/tasks/${selectedTask.id}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!res.ok) {
        throw new Error('Failed to delete photo')
      }

      setAttachments(attachments.filter((a) => a.id !== attachmentId))
      toast.success('Photo deleted')
    } catch (error: any) {
      toast.error('Failed to delete photo')
    }
  }

  const filteredTasks = tasks.filter((task) => {
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        task.title.toLowerCase().includes(searchLower) ||
        task.Property.name.toLowerCase().includes(searchLower) ||
        task.Property.nickname?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const getChecklistProgress = (task: Task) => {
    if (!task.TaskChecklist || !task.TaskChecklist.items) {
      return { completed: 0, total: 0, percentage: 0 }
    }
    const items = task.TaskChecklist.items as any[]
    const completed = items.filter((item: any) => item.completed).length
    const total = items.length
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cleaning Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <TableSkeletonLoader rows={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Cleaning Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Task, property..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger id="property">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.nickname || prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
                <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('PENDING')
                  setPropertyFilter('all')
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Tasks Table */}
          {filteredTasks.length === 0 ? (
            <EmptyState
              title="No cleaning tasks found"
              description="No cleaning tasks match your filters."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Photos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const progress = getChecklistProgress(task)
                  const hasPhotos = (task.TaskAttachment?.length || 0) > 0

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {task.Property.nickname || task.Property.name}
                            </div>
                            {task.Property.nickname && (
                              <div className="text-xs text-gray-500">
                                {task.Property.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        {task.dueAt ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{format(new Date(task.dueAt), 'MMM dd, yyyy')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.TaskChecklist ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CheckSquare className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">
                                {progress.completed}/{progress.total} items
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                            {task.checklistCompletedAt && (
                              <Badge variant="default" className="text-xs">
                                Completed
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">No checklist</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasPhotos ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {task.TaskAttachment?.length || 0} photo(s)
                          </Badge>
                        ) : (
                          <span className="text-gray-400">No photos</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              task.status === TaskStatus.COMPLETED
                                ? 'default'
                                : task.status === TaskStatus.IN_PROGRESS
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {task.status}
                          </Badge>
                          {task.isReadyForGuest && (
                            <Badge variant="default" className="bg-green-100 text-green-800 block w-fit">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenChecklist(task)}
                          >
                            <CheckSquare className="h-4 w-4 mr-1" />
                            Checklist
                          </Button>
                          {!task.isReadyForGuest && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleMarkReady(task)}
                              disabled={
                                !task.TaskChecklist ||
                                !task.checklistCompletedAt ||
                                (task.TaskChecklist.items as any[]).some(
                                  (item: any) => !item.completed
                                )
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark Ready
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mark Ready Confirmation Dialog */}
      <Dialog open={markReadyDialogOpen} onOpenChange={setMarkReadyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Cleaned and Ready</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this cleaning task as "Cleaned and Ready"?
            </DialogDescription>
          </DialogHeader>
          {taskToMarkReady && (
            <div className="space-y-2 py-4">
              <p className="text-sm text-gray-600">
                <strong>Property:</strong> {taskToMarkReady.Property.nickname || taskToMarkReady.Property.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Task:</strong> {taskToMarkReady.title}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setMarkReadyDialogOpen(false)}
              disabled={markingReady}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmMarkReady}
              disabled={markingReady}
            >
              {markingReady ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Marking...
                </>
              ) : (
                'Mark as Ready'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Cleaning Checklist - {selectedTask?.Property.nickname || selectedTask?.Property.name}
            </DialogTitle>
            <DialogDescription>{selectedTask?.title}</DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              {/* Checklist Items */}
              {checklistItems.length > 0 ? (
                <div className="space-y-3">
                  <Label>Checklist Items</Label>
                  {checklistItems.map((item: any, index: number) => (
                    <div key={item.id || index} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Checkbox
                        checked={item.completed || false}
                        onCheckedChange={() => handleChecklistItemToggle(index)}
                        className="mt-1"
                      />
                      <Label
                        className={`flex-1 cursor-pointer ${
                          item.completed ? 'line-through text-gray-500' : ''
                        }`}
                        onClick={() => handleChecklistItemToggle(index)}
                      >
                        {item.text}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No checklist items. Please select a checklist template first.
                </div>
              )}

              {/* Photos Section */}
              <div className="space-y-3">
                <Label>Photos</Label>
                <div className="grid grid-cols-3 gap-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative group">
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <label className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div className="text-center">
                      <Upload className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">
                        {uploading ? 'Uploading...' : 'Add Photo'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setChecklistDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSaveChecklist} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Checklist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

