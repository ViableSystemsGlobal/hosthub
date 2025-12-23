'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
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
import { format } from 'date-fns'
import { Plus, AlertCircle, CheckSquare, Square, Trash2, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { toast } from '@/lib/toast'

export function AdminIssuesPage() {
  const router = useRouter()
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchIssues()
  }, [filterStatus])

  useEffect(() => {
    // Refresh when page becomes visible (after returning from edit)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchIssues()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const fetchIssues = async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') {
        params.append('status', filterStatus)
      }

      const res = await fetch(`/api/issues?${params}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch issues:', errorData)
        throw new Error(errorData.error || 'Failed to fetch issues')
      }
      const data = await res.json()
      setIssues(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch issues:', error)
      setIssues([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedIssues.size === issues.length) {
      setSelectedIssues(new Set())
    } else {
      setSelectedIssues(new Set(issues.map(i => i.id)))
    }
  }

  const handleSelectIssue = (issueId: string) => {
    const newSelected = new Set(selectedIssues)
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId)
    } else {
      newSelected.add(issueId)
    }
    setSelectedIssues(newSelected)
  }

  const handleBulkUpdateStatus = async (status: string) => {
    if (selectedIssues.size === 0) return
    if (!confirm(`Update ${selectedIssues.size} issue(s) to ${status}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/issues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIssues),
          action: 'updateStatus',
          data: { status },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update issues')
      }
      toast.success('Bulk update successful', `Updated ${selectedIssues.size} issue(s)`)
      setSelectedIssues(new Set())
      fetchIssues()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkUpdatePriority = async (priority: string) => {
    if (selectedIssues.size === 0) return
    if (!confirm(`Update ${selectedIssues.size} issue(s) priority to ${priority}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/issues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIssues),
          action: 'updatePriority',
          data: { priority },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update issues')
      }
      toast.success('Bulk update successful', `Updated ${selectedIssues.size} issue(s)`)
      setSelectedIssues(new Set())
      fetchIssues()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIssues.size === 0) return
    if (!confirm(`Delete ${selectedIssues.size} issue(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/issues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIssues),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete issues')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedIssues.size} issue(s)`)
      setSelectedIssues(new Set())
      fetchIssues()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedIssues.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/issues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIssues),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export issues')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `issues-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedIssues.size} issue(s)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      toast.success('Status updated', 'Issue status has been updated')
      fetchIssues()
    } catch (error: any) {
      toast.error('Update failed', error.message)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'LOW':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'RESOLVED':
        return 'bg-green-100 text-green-800'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Issues</h1>
        <Link href="/admin/issues/new">
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" />
            New Issue
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Issues</CardTitle>
            <div className="flex items-center gap-2">
              {selectedIssues.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedIssues.size} selected
                  </span>
                  <Select
                    onValueChange={(value) => handleBulkUpdateStatus(value)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Set to Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">Set to In Progress</SelectItem>
                      <SelectItem value="RESOLVED">Set to Resolved</SelectItem>
                      <SelectItem value="CLOSED">Set to Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    onValueChange={(value) => handleBulkUpdatePriority(value)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Set to Low</SelectItem>
                      <SelectItem value="MEDIUM">Set to Medium</SelectItem>
                      <SelectItem value="HIGH">Set to High</SelectItem>
                      <SelectItem value="URGENT">Set to Urgent</SelectItem>
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
                    onClick={() => setSelectedIssues(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No issues found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {selectedIssues.size === issues.length && issues.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Maintenance Person</TableHead>
                  <TableHead>Attachments</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <button
                        onClick={() => handleSelectIssue(issue.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedIssues.has(issue.id) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {issue.Property?.nickname || issue.Property?.name || '-'}
                    </TableCell>
                    <TableCell>{issue.title}</TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(issue.priority)}>
                        {issue.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={issue.status}
                        onValueChange={(value) =>
                          handleStatusChange(issue.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {issue.AssignedContact ? (
                        <div>
                          <div className="font-medium text-sm">{issue.AssignedContact.name}</div>
                          {issue.AssignedContact.company && (
                            <div className="text-xs text-gray-500">{issue.AssignedContact.company}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {issue.IssueAttachment?.length > 0 ? (
                        <span className="text-sm text-gray-600">
                          {issue.IssueAttachment.length} file{issue.IssueAttachment.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No attachments</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(issue.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/issues/${issue.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

