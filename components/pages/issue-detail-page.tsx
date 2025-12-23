'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, Edit, Image as ImageIcon, Video, Upload, X, MessageSquare, Send } from 'lucide-react'
import Link from 'next/link'
import { IssueForm } from '@/components/forms/issue-form'
import { toast } from '@/lib/toast'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'

interface IssueDetailPageProps {
  issueId: string
}

export function IssueDetailPage({ issueId }: IssueDetailPageProps) {
  const router = useRouter()
  const [issue, setIssue] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<Array<{ url: string; type: string; name: string }>>([])
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    if (issueId) {
      fetchIssue(issueId)
      fetchComments()
    }
  }, [issueId])

  // Poll for new comments every 10 seconds
  useEffect(() => {
    if (!issueId) return

    const interval = setInterval(() => {
      fetchComments()
    }, 10000)

    return () => clearInterval(interval)
  }, [issueId])

  const fetchIssue = async (id: string) => {
    try {
      const res = await fetch(`/api/issues/${id}`)
      if (!res.ok) {
        throw new Error('Failed to fetch issue')
      }
      const data = await res.json()
      setIssue(data)
    } catch (error) {
      console.error('Failed to fetch issue:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    if (!issueId) return
    try {
      setLoadingComments(true)
      const res = await fetch(`/api/issues/${issueId}/comments`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch comments:', errorData)
        throw new Error(errorData.error || 'Failed to fetch comments')
      }
      const data = await res.json()
      setComments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch comments:', error)
      setComments([])
    } finally {
      setLoadingComments(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !issueId) return

    try {
      setSubmittingComment(true)
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add comment')
      }

      toast.success('Comment added', 'Your comment has been added successfully')
      setNewComment('')
      fetchComments()
    } catch (error: any) {
      toast.error('Failed to add comment', error.message)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
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
      fetchIssue(issueId)
    } catch (error: any) {
      toast.error('Update failed', error.message)
    }
  }

  // Determine if user can edit (admins and managers can edit)
  const canEdit = typeof window !== 'undefined' && (
    window.location.pathname.includes('/admin/') ||
    window.location.pathname.includes('/manager/')
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setNewFiles([...newFiles, ...selectedFiles])

    const filePreviews = selectedFiles.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name,
    }))
    setNewPreviews([...newPreviews, ...filePreviews])
  }

  const removeNewFile = (index: number) => {
    const updatedFiles = newFiles.filter((_, i) => i !== index)
    const updatedPreviews = newPreviews.filter((_, i) => i !== index)
    setNewFiles(updatedFiles)
    setNewPreviews(updatedPreviews)
  }

  const handleAddAttachments = async () => {
    if (newFiles.length === 0) return

    try {
      const formData = new FormData()
      newFiles.forEach((file) => {
        formData.append('files', file)
      })

      const res = await fetch(`/api/issues/${issueId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Failed to add attachments')
      }

      toast.success('Attachments added', 'New attachments have been added')
      setNewFiles([])
      setNewPreviews([])
      fetchIssue(issueId)
    } catch (error: any) {
      toast.error('Upload failed', error.message)
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
    return <div className="p-6">Loading...</div>
  }

  if (!issue) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Issue not found</p>
          <Button
            onClick={() => {
              const path = window.location.pathname
              if (path.includes('/admin/')) {
                router.push('/admin/issues')
              } else if (path.includes('/manager/')) {
                router.push('/manager/issues')
              } else if (path.includes('/owner/')) {
                router.push('/owner/issues')
              } else {
                router.push('/admin/issues')
              }
            }}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Issues
          </Button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Issue</h1>
          <Button variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <IssueForm
              issueId={issueId}
              initialData={issue}
              propertyId={issue.propertyId}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/admin/issues')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{issue.title}</h1>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Issue Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-600">Property</div>
              <div className="font-medium">
                {issue.Property?.nickname || issue.Property?.name || '-'}
              </div>
            </div>

            {issue.description && (
              <div>
                <div className="text-sm text-gray-600">Description</div>
                <div className="mt-1">{issue.description}</div>
              </div>
            )}

            <div className="flex gap-4">
              <div>
                <div className="text-sm text-gray-600">Priority</div>
                <Badge className={getPriorityColor(issue.priority)}>
                  {issue.priority}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                {canEdit ? (
                  <Select
                    value={issue.status}
                    onValueChange={(value) => handleStatusChange(value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    className={
                      issue.status === 'OPEN'
                        ? 'bg-red-100 text-red-800'
                        : issue.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800'
                        : issue.status === 'RESOLVED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {issue.status}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div>{format(new Date(issue.createdAt), 'MMM dd, yyyy HH:mm')}</div>
            </div>

            {issue.resolvedAt && (
              <div>
                <div className="text-sm text-gray-600">Resolved</div>
                <div>{format(new Date(issue.resolvedAt), 'MMM dd, yyyy HH:mm')}</div>
              </div>
            )}

            {issue.AssignedContact && (
              <div>
                <div className="text-sm text-gray-600">Maintenance Person</div>
                <div className="mt-1">
                  <div className="font-medium">{issue.AssignedContact.name}</div>
                  {issue.AssignedContact.company && (
                    <div className="text-sm text-gray-600">{issue.AssignedContact.company}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={`tel:${issue.AssignedContact.phoneNumber}`}
                      className="text-sm text-orange-600 hover:underline"
                    >
                      {issue.AssignedContact.phoneNumber}
                    </a>
                    {issue.AssignedContact.email && (
                      <>
                        <span className="text-gray-400">•</span>
                        <a
                          href={`mailto:${issue.AssignedContact.email}`}
                          className="text-sm text-orange-600 hover:underline"
                        >
                          {issue.AssignedContact.email}
                        </a>
                      </>
                    )}
                  </div>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {issue.AssignedContact.type}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {issue.IssueAttachment && issue.IssueAttachment.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {issue.IssueAttachment.map((attachment: any) => (
                  <div key={attachment.id} className="relative group">
                    {attachment.fileType === 'video' ? (
                      <video
                        src={attachment.fileUrl}
                        className="w-full h-24 object-cover rounded-lg"
                        controls
                      />
                    ) : (
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/50 text-white text-xs px-1 rounded">
                      {attachment.fileType === 'video' ? (
                        <Video className="w-3 h-3" />
                      ) : (
                        <ImageIcon className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No attachments</p>
            )}

            <div className="border-t pt-4">
              <div className="space-y-2">
                <input
                  type="file"
                  id="add-files"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="add-files"
                  className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900"
                >
                  <Upload className="w-4 h-4" />
                  Add Attachments
                </label>

                {newPreviews.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {newPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          {preview.type === 'video' ? (
                            <video
                              src={preview.url}
                              className="w-full h-20 object-cover rounded"
                              controls
                            />
                          ) : (
                            <img
                              src={preview.url}
                              alt={preview.name}
                              className="w-full h-20 object-cover rounded"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeNewFile(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAddAttachments}
                      className="w-full"
                    >
                      Upload {newFiles.length} file{newFiles.length > 1 ? 's' : ''}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Comments List */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {loadingComments ? (
              <div className="text-center py-4 text-gray-500">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-orange-100 text-orange-600">
                      {comment.User?.name?.[0]?.toUpperCase() || comment.User?.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {comment.User?.name || comment.User?.email || 'Unknown User'}
                      </span>
                      {comment.User?.role && (
                        <Badge variant="outline" className="text-xs">
                          {comment.User.role}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {submittingComment ? (
                    'Posting...'
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Post Comment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

