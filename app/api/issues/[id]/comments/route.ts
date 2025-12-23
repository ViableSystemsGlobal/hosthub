import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify issue exists and user has access
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            ownerId: true,
            managerId: true,
          },
        },
      },
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Check permissions
    const canAccess =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && issue.Property.managerId === user.id) ||
      (user.role === 'OWNER' && issue.Property.ownerId === user.ownerId) ||
      issue.reportedById === user.id ||
      issue.assignedToUserId === user.id

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const comments = await prisma.issueComment.findMany({
      where: { issueId: id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(comments)
  } catch (error: any) {
    console.error('Failed to fetch comments:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch comments',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { content } = body

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      )
    }

    // Verify issue exists and user has access
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            ownerId: true,
            managerId: true,
          },
        },
      },
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Check permissions - reporter, assigned user, managers, admins, and property owners can comment
    const canComment =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && issue.Property.managerId === user.id) ||
      (user.role === 'OWNER' && issue.Property.ownerId === user.ownerId) ||
      issue.reportedById === user.id ||
      issue.assignedToUserId === user.id

    if (!canComment) {
      return NextResponse.json(
        { error: 'You do not have permission to comment on this issue' },
        { status: 403 }
      )
    }

    const comment = await prisma.issueComment.create({
      data: {
        id: crypto.randomUUID(),
        issueId: id,
        userId: user.id,
        content: content.trim(),
        updatedAt: new Date(),
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Send notification for new comment (non-blocking)
    try {
      const { sendIssueNotification } = await import('@/lib/notifications/service')
      const recipientIds = [issue.Property.ownerId]
      
      // Send notification asynchronously (don't wait for it)
      sendIssueNotification(id, 'commented', recipientIds).catch((err) => {
        console.error('Failed to send comment notification:', err)
      })
    } catch (error) {
      // Don't fail the request if notification fails
      console.error('Notification error:', error)
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create comment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create comment' },
      { status: 500 }
    )
  }
}

