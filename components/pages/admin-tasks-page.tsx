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
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, ClipboardList, CheckCircle, Clock, AlertCircle, CheckSquare, Square, Trash2, Download, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { TaskType, TaskStatus } from '@prisma/client'
import { format } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'

interface Task {
  id: string
  type: TaskType
  title: string
  status: TaskStatus
  scheduledAt?: string
  dueAt?: string
  Property: {
    name: string
  }
}

export function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    type: '',
  })

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.type) params.append('type', filters.type)

      const res = await fetch(`/api/tasks?${params.toString()}`)
      const data = await res.json()
      // Handle error response or ensure data is an array
      setTasks(Array.isArray(data) ? data : [])
      
      // Fetch all tasks for metrics
      const allRes = await fetch('/api/tasks')
      const allData = await allRes.json()
      setAllTasks(Array.isArray(allData) ? allData : [])
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      setTasks([])
      setAllTasks([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const applyFilters = () => {
    setLoading(true)
    fetchTasks()
  }

  const handleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)))
    }
  }

  const handleSelectTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleBulkUpdateStatus = async (status: TaskStatus) => {
    if (selectedTasks.size === 0) return
    if (!confirm(`Update ${selectedTasks.size} task(s) to ${status}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedTasks),
          action: 'updateStatus',
          data: { status },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update tasks')
      }
      toast.success('Bulk update successful', `Updated ${selectedTasks.size} task(s)`)
      setSelectedTasks(new Set())
      fetchTasks()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return
    if (!confirm(`Delete ${selectedTasks.size} task(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedTasks),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete tasks')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedTasks.size} task(s)`)
      setSelectedTasks(new Set())
      fetchTasks()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedTasks.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedTasks),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export tasks')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedTasks.size} task(s)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'default'
      case TaskStatus.IN_PROGRESS:
        return 'secondary'
      case TaskStatus.CANCELLED:
        return 'destructive'
      default:
        return 'outline'
    }
  }

  // Calculate metrics
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.status === TaskStatus.COMPLETED).length
  const inProgressTasks = allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length
  const pendingTasks = allTasks.filter(t => t.status === TaskStatus.PENDING).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link href="/admin/tasks/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Tasks"
          value={totalTasks}
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Completed"
          value={completedTasks}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="In Progress"
          value={inProgressTasks}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Pending"
          value={pendingTasks}
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label>Status</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.values(TaskStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label>Type</label>
              <Select
                value={filters.type || 'all'}
                onValueChange={(value) => handleFilterChange('type', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.values(TaskType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label>&nbsp;</label>
              <Button onClick={applyFilters} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-12 h-12" />}
          title="No tasks found"
          description="Start managing your property tasks by creating your first task."
          action={{
            label: 'Add Task',
            href: '/admin/tasks/new',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Tasks</CardTitle>
              {selectedTasks.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedTasks.size} selected
                  </span>
                  <Select
                    onValueChange={(value) => handleBulkUpdateStatus(value as TaskStatus)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TaskStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          Set to {status}
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
                    onClick={() => setSelectedTasks(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {selectedTasks.size === tasks.length && tasks.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <button
                      onClick={() => handleSelectTask(task.id)}
                      className="flex items-center justify-center"
                    >
                      {selectedTasks.has(task.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {task.Property.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.type}</Badge>
                  </TableCell>
                  <TableCell>{task.title}</TableCell>
                  <TableCell>
                    {task.dueAt
                      ? format(new Date(task.dueAt), 'MMM dd, yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/tasks/${task.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  )
}

