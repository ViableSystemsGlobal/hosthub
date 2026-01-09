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
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { Mail, MessageSquare, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Pagination } from '@/components/ui/pagination'

// Local constants for notification types, channels, and statuses
const NotificationType = {
  STATEMENT_READY: 'STATEMENT_READY',
  PAYOUT_MADE: 'PAYOUT_MADE',
  TASK_UPDATE: 'TASK_UPDATE',
  MESSAGE: 'MESSAGE',
  ISSUE_CREATED: 'ISSUE_CREATED',
  ISSUE_ASSIGNED: 'ISSUE_ASSIGNED',
  ISSUE_STATUS_CHANGED: 'ISSUE_STATUS_CHANGED',
  ISSUE_COMMENTED: 'ISSUE_COMMENTED',
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_UPDATED: 'BOOKING_UPDATED',
  BOOKING_REMINDER: 'BOOKING_REMINDER',
  OTHER: 'OTHER',
} as const

const NotificationChannel = {
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
} as const

const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const

interface Notification {
  id: string
  ownerId: string
  type: string
  channel: string
  status: string
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
  payload: {
    title?: string
    message?: string
    metadata?: Record<string, any>
  }
  Owner: {
    id: string
    name: string
    email: string | null
  }
}

export function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchNotifications()
    
    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterChannel !== 'all') params.append('channel', filterChannel)
      if (filterStatus !== 'all') params.append('status', filterStatus)
      
      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) {
        throw new Error('Failed to fetch notifications')
      }
      const data = await res.json()
      setNotifications(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error)
      toast.error('Failed to fetch notifications', error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    setCurrentPage(1) // Reset to first page when filters change
  }, [filterChannel, filterStatus])

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      STATEMENT_READY: 'Statement Ready',
      PAYOUT_MADE: 'Payout Made',
      TASK_UPDATE: 'Task Update',
      MESSAGE: 'Message',
      ISSUE_CREATED: 'Issue Created',
      ISSUE_ASSIGNED: 'Issue Assigned',
      ISSUE_STATUS_CHANGED: 'Issue Status Changed',
      ISSUE_COMMENTED: 'Issue Commented',
      BOOKING_CREATED: 'Booking Created',
      BOOKING_UPDATED: 'Booking Updated',
      BOOKING_REMINDER: 'Booking Reminder',
      OTHER: 'Other',
    }
    return labels[type] || type
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return <Mail className="w-4 h-4" />
      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        return <MessageSquare className="w-4 h-4" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case NotificationStatus.SENT:
        return <Badge className="bg-green-100 text-green-800">Sent</Badge>
      case NotificationStatus.PENDING:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case NotificationStatus.FAILED:
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading && notifications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-gray-600 mt-1">View all sent notifications and their status</p>
        </div>
        <Button onClick={fetchNotifications} variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Notifications</CardTitle>
            <div className="flex gap-2">
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value={NotificationChannel.EMAIL}>Email</SelectItem>
                  <SelectItem value={NotificationChannel.SMS}>SMS</SelectItem>
                  <SelectItem value={NotificationChannel.WHATSAPP}>WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={NotificationStatus.SENT}>Sent</SelectItem>
                  <SelectItem value={NotificationStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={NotificationStatus.FAILED}>Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No notifications found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(notification.createdAt), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{notification.Owner.name}</div>
                          {notification.Owner.email && (
                            <div className="text-sm text-gray-500">{notification.Owner.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeLabel(notification.type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChannelIcon(notification.channel)}
                          <span>{notification.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {notification.payload?.title || notification.payload?.message || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {notification.errorMessage ? (
                          <span className="text-red-600 text-sm">{notification.errorMessage}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {notifications.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(notifications.length / pageSize)}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  totalItems={notifications.length}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

