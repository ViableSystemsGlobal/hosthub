'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { ClipboardList, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { TaskStatus, TaskType } from '@prisma/client'
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

export function ManagerTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/manager/tasks')
      if (!res.ok) {
        throw new Error('Failed to fetch tasks')
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setTasks(data)
      } else {
        setTasks([])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  // Calculate metrics
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length
  const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING).length

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>

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

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-12 h-12" />}
          title="No tasks found"
          description="Tasks for your assigned properties will appear here."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
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

