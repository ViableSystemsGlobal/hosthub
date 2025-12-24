'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sparkles, Filter, CheckCircle, Clock, XCircle, Eye } from 'lucide-react'
import { TaskStatus, TaskType } from '@prisma/client'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CleaningChecklist } from '@/components/ui/cleaning-checklist'
import Image from 'next/image'

interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  scheduledAt: Date | null
  dueAt: Date | null
  checklistCompletedAt: Date | null
  isReadyForGuest: boolean
  Property: {
    id: string
    name: string
    nickname: string | null
  }
  Booking: {
    id: string
    guestName: string | null
    checkInDate: Date
  } | null
  TaskChecklist?: any[]
  TaskAttachment?: Array<{
    id: string
    url: string
    type: string
  }>
}

export function OwnerCleaningTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; name: string; nickname: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    if (properties.length > 0) {
      fetchTasks()
    }
  }, [statusFilter, propertyFilter, properties])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setProperties(data || [])
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
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: TaskStatus, isReady: boolean) => {
    if (isReady) {
      return <Badge className="bg-green-100 text-green-800">Ready for Guest</Badge>
    }
    switch (status) {
      case TaskStatus.COMPLETED:
        return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>
      case TaskStatus.IN_PROGRESS:
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>
      case TaskStatus.PENDING:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
      case TaskStatus.CANCELLED:
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const handleViewTask = async (task: Task) => {
    setSelectedTask(task)
    setViewDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            Cleaning Tasks
          </h1>
          <p className="text-gray-600 mt-1">View cleaning status for your properties</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Property</label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.nickname || property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                  <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value="ready">Ready for Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cleaning Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No cleaning tasks found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks
                  .filter((task) => {
                    if (statusFilter === 'ready') {
                      return task.isReadyForGuest
                    }
                    return true
                  })
                  .map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        {task.Property.nickname || task.Property.name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-gray-500">{task.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.Booking?.guestName || '-'}
                      </TableCell>
                      <TableCell>
                        {task.dueAt ? format(new Date(task.dueAt), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status, task.isReadyForGuest)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewTask(task)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Task Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cleaning Task Details</DialogTitle>
            <DialogDescription>
              {selectedTask?.Property.nickname || selectedTask?.Property.name}
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Task</p>
                  <p className="font-semibold">{selectedTask.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedTask.status, selectedTask.isReadyForGuest)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Due Date</p>
                  <p>{selectedTask.dueAt ? format(new Date(selectedTask.dueAt), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Guest</p>
                  <p>{selectedTask.Booking?.guestName || '-'}</p>
                </div>
              </div>

              {selectedTask.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Description</p>
                  <p>{selectedTask.description}</p>
                </div>
              )}

              {selectedTask.TaskChecklist && selectedTask.TaskChecklist.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Checklist</p>
                  <CleaningChecklist
                    taskId={selectedTask.id}
                    propertyId={selectedTask.Property.id}
                    canEdit={false}
                  />
                </div>
              )}

              {selectedTask.TaskAttachment && selectedTask.TaskAttachment.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Photos</p>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedTask.TaskAttachment.map((attachment) => (
                      <div key={attachment.id} className="relative aspect-square rounded-lg overflow-hidden border">
                        <Image
                          src={attachment.url}
                          alt="Cleaning photo"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

