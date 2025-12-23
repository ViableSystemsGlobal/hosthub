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
  History,
  Loader2,
  Workflow,
  X,
  Check,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'

const WORKFLOW_TRIGGERS = [
  { value: 'BOOKING_CREATED', label: 'Booking Created' },
  { value: 'BOOKING_UPDATED', label: 'Booking Updated' },
  { value: 'BOOKING_STATUS_CHANGED', label: 'Booking Status Changed' },
  { value: 'BOOKING_CHECKOUT', label: 'Booking Checkout' },
  { value: 'TASK_CREATED', label: 'Task Created' },
  { value: 'TASK_COMPLETED', label: 'Task Completed' },
  { value: 'TASK_OVERDUE', label: 'Task Overdue' },
  { value: 'ISSUE_CREATED', label: 'Issue Created' },
  { value: 'ISSUE_STATUS_CHANGED', label: 'Issue Status Changed' },
  { value: 'ISSUE_PRIORITY_CHANGED', label: 'Issue Priority Changed' },
  { value: 'EXPENSE_CREATED', label: 'Expense Created' },
  { value: 'STATEMENT_FINALIZED', label: 'Statement Finalized' },
  { value: 'SCHEDULED', label: 'Scheduled' },
] as const

const WORKFLOW_ACTIONS = [
  { value: 'CREATE_TASK', label: 'Create Task' },
  { value: 'ASSIGN_TASK', label: 'Assign Task' },
  { value: 'SEND_NOTIFICATION', label: 'Send Notification' },
  { value: 'UPDATE_STATUS', label: 'Update Status' },
  { value: 'UPDATE_PRIORITY', label: 'Update Priority' },
  { value: 'SEND_EMAIL', label: 'Send Email' },
  { value: 'SEND_SMS', label: 'Send SMS' },
  { value: 'SEND_WHATSAPP', label: 'Send WhatsApp' },
] as const

const CONDITION_OPERATORS = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EQUALS', label: 'Not Equals' },
  { value: 'GREATER_THAN', label: 'Greater Than' },
  { value: 'LESS_THAN', label: 'Less Than' },
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'IN', label: 'In' },
  { value: 'NOT_IN', label: 'Not In' },
] as const

interface WorkflowRule {
  id: string
  name: string
  description?: string
  trigger: string
  isActive: boolean
  priority: number
  conditions?: any[]
  actions: any[]
  propertyIds: string[]
  ownerIds: string[]
  scheduleCron?: string
  executionCount: number
  lastExecutedAt?: string
  createdAt: string
  CreatedBy?: {
    id: string
    name?: string
    email: string
  }
}

export function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowRule | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [filterTrigger, setFilterTrigger] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [viewingExecutions, setViewingExecutions] = useState<string | null>(null)
  const [executions, setExecutions] = useState<any[]>([])
  const [loadingExecutions, setLoadingExecutions] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: '',
    isActive: true,
    priority: 0,
    conditions: [] as any[],
    actions: [] as any[],
    propertyIds: [] as string[],
    ownerIds: [] as string[],
    scheduleCron: '',
  })

  useEffect(() => {
    fetchWorkflows()
    fetchProperties()
    fetchOwners()
    fetchUsers()
  }, [])

  useEffect(() => {
    if (viewingExecutions) {
      fetchExecutions(viewingExecutions)
    }
  }, [viewingExecutions])

  const fetchWorkflows = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterTrigger !== 'all') params.append('trigger', filterTrigger)
      if (filterActive !== 'all') params.append('isActive', filterActive === 'active' ? 'true' : 'false')
      
      const res = await fetch(`/api/workflows?${params}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error('Unauthorized. Please log in.')
          return
        }
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || `Failed to fetch workflows (${res.status})`
        
        // Special handling for model not available error
        if (res.status === 503 && errorMessage.includes('restart')) {
          toast.error('Please restart the server. Run: npm run dev')
        } else {
          toast.error(errorMessage)
        }
        throw new Error(errorMessage)
      }
      const data = await res.json()
      setWorkflows(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch workflows:', error)
      toast.error(error.message || 'Failed to fetch workflows')
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
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchExecutions = async (workflowId: string) => {
    try {
      setLoadingExecutions(true)
      const res = await fetch(`/api/workflows/${workflowId}/executions?limit=50`)
      if (res.ok) {
        const data = await res.json()
        setExecutions(data.executions || [])
      }
    } catch (error) {
      console.error('Failed to fetch executions:', error)
    } finally {
      setLoadingExecutions(false)
    }
  }

  useEffect(() => {
    fetchWorkflows()
  }, [filterTrigger, filterActive])

  const handleOpenDialog = (workflow?: WorkflowRule) => {
    if (workflow) {
      setEditingWorkflow(workflow)
      setFormData({
        name: workflow.name,
        description: workflow.description || '',
        trigger: workflow.trigger,
        isActive: workflow.isActive,
        priority: workflow.priority,
        conditions: (workflow.conditions as any[]) || [],
        actions: workflow.actions || [],
        propertyIds: workflow.propertyIds || [],
        ownerIds: workflow.ownerIds || [],
        scheduleCron: workflow.scheduleCron || '',
      })
    } else {
      setEditingWorkflow(null)
      setFormData({
        name: '',
        description: '',
        trigger: '',
        isActive: true,
        priority: 0,
        conditions: [],
        actions: [],
        propertyIds: [],
        ownerIds: [],
        scheduleCron: '',
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.trigger || formData.actions.length === 0) {
      toast.error('Name, trigger, and at least one action are required')
      return
    }

    try {
      const url = editingWorkflow
        ? `/api/workflows/${editingWorkflow.id}`
        : '/api/workflows'
      const method = editingWorkflow ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save workflow')
      }

      toast.success(`Workflow ${editingWorkflow ? 'updated' : 'created'} successfully`)
      setDialogOpen(false)
      fetchWorkflows()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save workflow')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return

    try {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete workflow')
      toast.success('Workflow deleted successfully')
      fetchWorkflows()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workflow')
    }
  }

  const handleToggleActive = async (workflow: WorkflowRule) => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !workflow.isActive }),
      })
      if (!res.ok) throw new Error('Failed to update workflow')
      toast.success(`Workflow ${!workflow.isActive ? 'activated' : 'deactivated'}`)
      fetchWorkflows()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workflow')
    }
  }

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { field: '', operator: 'EQUALS', value: '' },
      ],
    })
  }

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    })
  }

  const updateCondition = (index: number, field: string, value: any) => {
    const updated = [...formData.conditions]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, conditions: updated })
  }

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [
        ...formData.actions,
        { type: 'SEND_NOTIFICATION', params: {} },
      ],
    })
  }

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    })
  }

  const updateAction = (index: number, field: string, value: any) => {
    const updated = [...formData.actions]
    if (field === 'type') {
      updated[index] = { type: value, params: {} }
    } else {
      updated[index] = { ...updated[index], params: { ...updated[index].params, [field]: value } }
    }
    setFormData({ ...formData, actions: updated })
  }

  const filteredWorkflows = workflows

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflow Rules</h1>
          <p className="text-gray-500">Automate tasks and notifications based on events</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Auto-assign urgent issues"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this workflow does"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trigger *</Label>
                  <Select
                    value={formData.trigger}
                    onValueChange={(value) => setFormData({ ...formData, trigger: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_TRIGGERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500">Higher priority runs first</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Active</Label>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Conditions (Optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Condition
                  </Button>
                </div>
                {formData.conditions.length === 0 ? (
                  <p className="text-sm text-gray-500">No conditions (workflow always runs)</p>
                ) : (
                  <div className="space-y-2">
                    {formData.conditions.map((condition, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <Input
                          placeholder="Field (e.g., status)"
                          value={condition.field}
                          onChange={(e) => updateCondition(index, 'field', e.target.value)}
                          className="flex-1"
                        />
                        <Select
                          value={condition.operator}
                          onValueChange={(value) => updateCondition(index, 'operator', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITION_OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Value"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCondition(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Actions *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAction}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Action
                  </Button>
                </div>
                {formData.actions.length === 0 ? (
                  <p className="text-sm text-red-500">At least one action is required</p>
                ) : (
                  <div className="space-y-4">
                    {formData.actions.map((action, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Action {index + 1}</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAction(index)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <Select
                              value={action.type}
                              onValueChange={(value) => updateAction(index, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WORKFLOW_ACTIONS.map((a) => (
                                  <SelectItem key={a.value} value={a.value}>
                                    {a.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Action-specific params */}
                            {action.type === 'CREATE_TASK' && (
                              <div className="space-y-2">
                                <Input
                                  placeholder="Task Title"
                                  value={action.params?.title || ''}
                                  onChange={(e) => updateAction(index, 'title', e.target.value)}
                                />
                                <Textarea
                                  placeholder="Task Description"
                                  value={action.params?.description || ''}
                                  onChange={(e) => updateAction(index, 'description', e.target.value)}
                                  rows={2}
                                />
                                <Select
                                  value={action.params?.type || ''}
                                  onValueChange={(value) => updateAction(index, 'type', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Task Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="CLEANING">Cleaning</SelectItem>
                                    <SelectItem value="REPAIR">Repair</SelectItem>
                                    <SelectItem value="INSPECTION">Inspection</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {action.type === 'SEND_NOTIFICATION' && (
                              <div className="space-y-2">
                                <Input
                                  placeholder="Title"
                                  value={action.params?.title || ''}
                                  onChange={(e) => updateAction(index, 'title', e.target.value)}
                                />
                                <Textarea
                                  placeholder="Message"
                                  value={action.params?.message || ''}
                                  onChange={(e) => updateAction(index, 'message', e.target.value)}
                                  rows={3}
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Scope */}
              <div className="space-y-4">
                <div>
                  <Label>Property Scope (Leave empty for all properties)</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                    {properties.map((prop) => (
                      <div key={prop.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.propertyIds.includes(prop.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                propertyIds: [...formData.propertyIds, prop.id],
                              })
                            } else {
                              setFormData({
                                ...formData,
                                propertyIds: formData.propertyIds.filter((id) => id !== prop.id),
                              })
                            }
                          }}
                        />
                        <Label className="text-sm">{prop.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Owner Scope (Leave empty for all owners)</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                    {owners.map((owner) => (
                      <div key={owner.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.ownerIds.includes(owner.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                ownerIds: [...formData.ownerIds, owner.id],
                              })
                            } else {
                              setFormData({
                                ...formData,
                                ownerIds: formData.ownerIds.filter((id) => id !== owner.id),
                              })
                            }
                          }}
                        />
                        <Label className="text-sm">{owner.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingWorkflow ? 'Update' : 'Create'} Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Trigger</Label>
              <Select value={filterTrigger} onValueChange={setFilterTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Triggers</SelectItem>
                  {WORKFLOW_TRIGGERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

      {/* Workflows Table */}
      {loading ? (
        <TableSkeletonLoader />
      ) : filteredWorkflows.length === 0 ? (
        <EmptyState
          icon={<Workflow className="w-12 h-12" />}
          title="No workflows found"
          description="Create your first workflow rule to automate tasks and notifications"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Workflows ({filteredWorkflows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Executions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {WORKFLOW_TRIGGERS.find((t) => t.value === workflow.trigger)?.label || workflow.trigger}
                      </Badge>
                    </TableCell>
                    <TableCell>{workflow.priority}</TableCell>
                    <TableCell>{workflow.actions.length}</TableCell>
                    <TableCell>{workflow.executionCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={workflow.isActive}
                          onCheckedChange={() => handleToggleActive(workflow)}
                        />
                        <span className={workflow.isActive ? 'text-green-600' : 'text-gray-400'}>
                          {workflow.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {workflow.lastExecutedAt
                        ? format(new Date(workflow.lastExecutedAt), 'MMM dd, yyyy HH:mm')
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewingExecutions(workflow.id)}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(workflow)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(workflow.id)}
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

      {/* Executions Dialog */}
      <Dialog open={!!viewingExecutions} onOpenChange={(open) => !open && setViewingExecutions(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
          </DialogHeader>
          {loadingExecutions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No executions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Executed At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((exec) => (
                  <TableRow key={exec.id}>
                    <TableCell>
                      {format(new Date(exec.executedAt), 'MMM dd, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          exec.status === 'SUCCESS'
                            ? 'default'
                            : exec.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {exec.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-red-600">
                      {exec.errorMessage || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

