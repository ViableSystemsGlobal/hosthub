import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { IssueStatus, IssuePriority } from '@prisma/client'

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

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
            ownerId: true,
            managerId: true,
          },
        },
        IssueAttachment: true,
        AssignedContact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            type: true,
            company: true,
          },
        },
      },
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Check permissions
    if (user.role === 'MANAGER' && issue.Property.managerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (user.role === 'OWNER' && issue.Property.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(issue)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch issue' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const { title, description, status, priority, assignedToUserId, assignedContactId } = body

    // Get existing issue
    const existingIssue = await prisma.issue.findUnique({
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

    if (!existingIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    // Check permissions - only admins, managers of the property, or owners can update
    const canUpdate =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && existingIssue.Property.managerId === user.id) ||
      (user.role === 'OWNER' && existingIssue.Property.ownerId === user.ownerId)

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (status !== undefined) {
      updateData.status = status as IssueStatus
      if (status === IssueStatus.RESOLVED || status === IssueStatus.CLOSED) {
        updateData.resolvedAt = new Date()
        updateData.resolvedById = user.id
      }
    }
    if (priority !== undefined) updateData.priority = priority as IssuePriority
    if (assignedToUserId !== undefined) {
      updateData.assignedToUserId = assignedToUserId || null
    }
    if (assignedContactId !== undefined) {
      updateData.assignedContactId = assignedContactId || null
    }

    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: updateData,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
            ownerId: true,
          },
        },
        IssueAttachment: true,
        AssignedContact: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            type: true,
            company: true,
            ownerId: true,
          },
        },
      },
    })

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      
      // Check if status changed
      if (status !== undefined && existingIssue.status !== status) {
        executeWorkflows('ISSUE_STATUS_CHANGED', {
          entityType: 'issue',
          entityId: updatedIssue.id,
          entityData: updatedIssue,
          propertyId: updatedIssue.Property.id,
          ownerId: updatedIssue.Property.ownerId,
        }).catch((err) => {
          console.error('Failed to execute workflows for issue status change:', err)
        })
      }
      
      // Check if priority changed
      if (priority !== undefined && existingIssue.priority !== priority) {
        executeWorkflows('ISSUE_PRIORITY_CHANGED', {
          entityType: 'issue',
          entityId: updatedIssue.id,
          entityData: updatedIssue,
          propertyId: updatedIssue.Property.id,
          ownerId: updatedIssue.Property.ownerId,
        }).catch((err) => {
          console.error('Failed to execute workflows for issue priority change:', err)
        })
      }
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    // Send notifications (non-blocking)
    try {
      const { sendIssueNotification } = await import('@/lib/notifications/service')
      const recipientIds = [updatedIssue.Property.ownerId]

      // Determine notification event
      let event: 'assigned' | 'status_changed' | undefined
      if (assignedContactId !== undefined && assignedContactId) {
        event = 'assigned'
        // If assigned to a contact, notify the contact's owner if applicable
        if (updatedIssue.AssignedContact?.ownerId && !recipientIds.includes(updatedIssue.AssignedContact.ownerId)) {
          recipientIds.push(updatedIssue.AssignedContact.ownerId)
        }
      } else if (status !== undefined) {
        event = 'status_changed'
      }

      if (event) {
        // Send notification asynchronously (don't wait for it)
        sendIssueNotification(id, event, recipientIds).catch((err) => {
          console.error('Failed to send issue notification:', err)
        })
      }
    } catch (error) {
      // Don't fail the request if notification fails
      console.error('Notification error:', error)
    }

    return NextResponse.json(updatedIssue)
  } catch (error: any) {
    console.error('Failed to update issue:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update issue' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Only admins can delete issues
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.issue.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete issue' },
      { status: 500 }
    )
  }
}

