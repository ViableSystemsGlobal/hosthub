'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Plus,
  Edit,
  Trash2,
  Play,
  Loader2,
  Repeat,
  Calendar,
  X,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import { TaskType } from '@prisma/client'

const FREQUENCIES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
] as const

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
] as const

const TASK_TYPES = [
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'OTHER', label: 'Other' },
] as const

interface RecurringTask {
  id: string
  propertyId?: string
  ownerId?: string
  type: TaskType
  title: string
  description?: string
  assignedToUserId?: string
  frequency: string
  interval: number
  dayOfWeek?: string
  dayOfMonth?: number
  startDate: string
  endDate?: string
  nextRunDate: string
  isActive: boolean
  costEstimate?: number
  totalGenerated: number
  lastGeneratedAt?: string
  Property?: { id: string; name: string; nickname?: string }
  Owner?: { id: string; name: string }
  CreatedBy?: { id: string; name?: string; email: string }
}

export function AdminRecurringTasksPage() {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [filterActive, setFilterActive] = useState<string>('all')
  const [generating, setGenerating] = useState(false)

  const [formData, setFormData] = useState({
    propertyId: '',
    ownerId: '',
    type: 'CLEANING' as TaskType,
    title: '',
    description: '',
    assignedToUserId: '',
    frequency: 'MONTHLY',
    interval: 1,
    dayOfWeek: '',
    dayOfMonth: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    costEstimate: '',
    isActive: true,
  })

  useEffect(() => {
    fetchRecurringTasks()
    fetchProperties()
    fetchOwners()
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchRecurringTasks()
  }, [filterActive])

  const fetchRecurringTasks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterActive !== 'all') {
        params.append('isActive', filterActive === 'active' ? 'true' : 'false')
      }

      const res = await fetch(`/api/recurring-tasks?${params}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error('Unauthorized. Please log in.')
          return
        }
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch recurring tasks (${res.status})`)
      }
      const data = await res.json()
      setRecurringTasks(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch recurring tasks:', error)
      toast.error(error.message || 'Failed to fetch recurring tasks')
    } finally {
      setLoading(false)
    }
  }

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

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      if (res.ok) {
        const data = await res.json()
        setOwners(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        const assignableUsers = data.filter((u: any) =>
          ['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'OPERATIONS'].includes(u.role)
        )
        setUsers(assignableUsers)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleOpenDialog = (task?: RecurringTask) => {
    if (task) {
      setEditingTask(task)
      setFormData({
        propertyId: task.propertyId || '',
        ownerId: task.ownerId || '',
        type: task.type,
        title: task.title,
        description: task.description || '',
        assignedToUserId: task.assignedToUserId || '',
        frequency: task.frequency,
        interval: task.interval,
        dayOfWeek: task.dayOfWeek || '',
        dayOfMonth: task.dayOfMonth?.toString() || '',
        startDate: format(new Date(task.startDate), 'yyyy-MM-dd'),
        endDate: task.endDate ? format(new Date(task.endDate), 'yyyy-MM-dd') : '',
        costEstimate: task.costEstimate?.toString() || '',
        isActive: task.isActive,
      })
    } else {
      setEditingTask(null)
      setFormData({
        propertyId: '',
        ownerId: '',
        type: 'CLEANING',
        title: '',
        description: '',
        assignedToUserId: '',
        frequency: 'MONTHLY',
        interval: 1,
        dayOfWeek: '',
        dayOfMonth: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        costEstimate: '',
        isActive: true,
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.startDate) {
      toast.error('Title and start date are required')
      return
    }

    if (!formData.propertyId && !formData.ownerId) {
      toast.error('Either property or owner must be selected')
      return
    }

    try {
      const url = editingTask
        ? `/api/recurring-tasks/${editingTask.id}`
        : '/api/recurring-tasks'
      const method = editingTask ? 'PATCH' : 'POST'

      const payload: any = {
        ...formData,
        propertyId: formData.propertyId || null,
        ownerId: formData.ownerId || null,
        assignedToUserId: formData.assignedToUserId || null,
        dayOfWeek: formData.dayOfWeek || null,
        dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth) : null,
        costEstimate: formData.costEstimate ? parseFloat(formData.costEstimate) : null,
        endDate: formData.endDate || null,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save recurring task')
      }

      toast.success(`Recurring task ${editingTask ? 'updated' : 'created'} successfully`)
      setDialogOpen(false)
      fetchRecurringTasks()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save recurring task')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring task?')) return

    try {
      const res = await fetch(`/api/recurring-tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete recurring task')
      toast.success('Recurring task deleted successfully')
      fetchRecurringTasks()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete recurring task')
    }
  }

  const handleToggleActive = async (task: RecurringTask) => {
    try {
      const res = await fetch(`/api/recurring-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !task.isActive }),
      })
      if (!res.ok) throw new Error('Failed to update recurring task')
      toast.success(`Recurring task ${!task.isActive ? 'activated' : 'deactivated'}`)
      fetchRecurringTasks()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update recurring task')
    }
  }

  const handleGenerateNow = async () => {
    try {
      setGenerating(true)
      const res = await fetch('/api/recurring-tasks/generate', {
        method: 'POST',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate tasks')
      }
      const result = await res.json()
      toast.success(`Generated ${result.generated} task(s)`)
      if (result.errors && result.errors.length > 0) {
        console.warn('Generation errors:', result.errors)
      }
      fetchRecurringTasks()
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate tasks')
    } finally {
      setGenerating(false)
    }
  }

  const filteredTasks = recurringTasks

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Tasks</h1>
          <p className="text-gray-500">Automatically generate tasks on a schedule</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateNow}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Generate Now
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                New Recurring Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTask ? 'Edit Recurring Task' : 'Create Recurring Task'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Monthly Property Inspection"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Task description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Task Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value as TaskType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <Select
                      value={formData.assignedToUserId || '__none__'}
                      onValueChange={(value) => setFormData({ ...formData, assignedToUserId: value === '__none__' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property</Label>
                    <Select
                      value={formData.propertyId || '__none__'}
                      onValueChange={(value) => setFormData({ ...formData, propertyId: value === '__none__' ? '' : value, ownerId: value === '__none__' ? '' : formData.ownerId })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nickname || p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Select
                      value={formData.ownerId || '__none__'}
                      onValueChange={(value) => setFormData({ ...formData, ownerId: value === '__none__' ? '' : value, propertyId: value === '__none__' ? '' : formData.propertyId })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {owners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency *</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData({ ...formData, frequency: value, dayOfWeek: '', dayOfMonth: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Interval</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.interval}
                      onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) || 1 })}
                      placeholder="1"
                    />
                    <p className="text-xs text-gray-500">Every N {formData.frequency.toLowerCase()}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Estimate</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.costEstimate}
                      onChange={(e) => setFormData({ ...formData, costEstimate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {formData.frequency === 'WEEKLY' && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select
                      value={formData.dayOfWeek || '__any__'}
                      onValueChange={(value) => setFormData({ ...formData, dayOfWeek: value === '__any__' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any day</SelectItem>
                        {DAYS_OF_WEEK.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(formData.frequency === 'MONTHLY' || formData.frequency === 'QUARTERLY' || formData.frequency === 'YEARLY') && (
                  <div className="space-y-2">
                    <Label>Day of Month (Optional)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dayOfMonth}
                      onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                      placeholder="e.g., 1 (first of month)"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingTask ? 'Update' : 'Create'} Recurring Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Status</Label>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recurring Tasks Table */}
      {loading ? (
        <TableSkeletonLoader />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-12 h-12" />}
          title="No recurring tasks found"
          description="Create your first recurring task to automate task generation"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recurring Tasks ({filteredTasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Property/Owner</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TASK_TYPES.find((t) => t.value === task.type)?.label || task.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-gray-400" />
                        <span>
                          Every {task.interval} {FREQUENCIES.find((f) => f.value === task.frequency)?.label.toLowerCase()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.Property ? (
                        <span className="text-sm">{task.Property.nickname || task.Property.name}</span>
                      ) : task.Owner ? (
                        <span className="text-sm">{task.Owner.name}</span>
                      ) : (
                        <span className="text-sm text-gray-400">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {format(new Date(task.nextRunDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{task.totalGenerated}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={task.isActive}
                          onCheckedChange={() => handleToggleActive(task)}
                        />
                        <span className={task.isActive ? 'text-green-600' : 'text-gray-400'}>
                          {task.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(task)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(task.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

