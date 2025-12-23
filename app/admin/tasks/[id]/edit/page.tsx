'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskType, TaskStatus } from '@prisma/client'
import { toast } from '@/lib/toast'
import { CleaningChecklist } from '@/components/ui/cleaning-checklist'

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState<any>(null)
  const [formData, setFormData] = useState<{
    type: TaskType
    title: string
    description: string
    status: TaskStatus
    scheduledAt: string
    dueAt: string
    costEstimate: number
    costActual: number
  }>({
    type: TaskType.CLEANING,
    title: '',
    description: '',
    status: TaskStatus.PENDING,
    scheduledAt: '',
    dueAt: '',
    costEstimate: 0,
    costActual: 0,
  })

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setTask(data)
        setFormData({
          type: data.type,
          title: data.title,
          description: data.description || '',
          status: data.status,
          scheduledAt: data.scheduledAt
            ? new Date(data.scheduledAt).toISOString().split('T')[0]
            : '',
          dueAt: data.dueAt
            ? new Date(data.dueAt).toISOString().split('T')[0]
            : '',
          costEstimate: data.costEstimate || 0,
          costActual: data.costActual || 0,
        })
      })
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update task')
      }

      toast.success('Task updated', 'Task has been updated successfully')
      router.push('/admin/tasks')
      router.refresh()
    } catch (error: any) {
      toast.error('Error', error.message)
      setLoading(false)
    }
  }

  if (!task) return <div>Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Task</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as TaskType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskType).map((type) => (
                      <SelectItem key={type} value={type as string}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as TaskStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TaskStatus).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Scheduled At</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledAt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueAt">Due At</Label>
                <Input
                  id="dueAt"
                  type="datetime-local"
                  value={formData.dueAt}
                  onChange={(e) =>
                    setFormData({ ...formData, dueAt: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costEstimate">Cost Estimate</Label>
                <Input
                  id="costEstimate"
                  type="number"
                  step="0.01"
                  value={formData.costEstimate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costEstimate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costActual">Cost Actual</Label>
                <Input
                  id="costActual"
                  type="number"
                  step="0.01"
                  value={formData.costActual}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costActual: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Task'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Cleaning Checklist - Show for cleaning tasks */}
      {task && task.type === TaskType.CLEANING && (
        <Card className="mt-6">
          <CleaningChecklist
            taskId={id}
            propertyId={task.propertyId}
            canEdit={true}
          />
        </Card>
      )}
    </div>
  )
}

