import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { IssueStatus, IssuePriority } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const status = searchParams.get('status')
    const assignedToUserId = searchParams.get('assignedToUserId')

    const where: any = {}

    // Managers can only see issues for properties they manage
    if (user.role === 'MANAGER') {
      const managedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const propertyIds = managedProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json([])
      }
      where.propertyId = { in: propertyIds }
      if (propertyId && propertyIds.includes(propertyId)) {
        where.propertyId = propertyId
      }
    } else if (user.role === 'OWNER') {
      // Owners can only see issues for their properties
      const ownerProperties = await prisma.property.findMany({
        where: { ownerId: user.ownerId! },
        select: { id: true },
      })
      const propertyIds = ownerProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json([])
      }
      where.propertyId = { in: propertyIds }
      if (propertyId && propertyIds.includes(propertyId)) {
        where.propertyId = propertyId
      }
    } else {
      // Admin can see all or filter by propertyId
      if (propertyId) where.propertyId = propertyId
    }

    if (status && Object.values(IssueStatus).includes(status as IssueStatus)) {
      where.status = status as IssueStatus
    }
    if (assignedToUserId) where.assignedToUserId = assignedToUserId

    const issues = await prisma.issue.findMany({
      where,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            nickname: true,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(issues)
  } catch (error: any) {
    console.error('Failed to fetch issues:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch issues',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const propertyId = formData.get('propertyId') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const priority = (formData.get('priority') as string) || 'MEDIUM'
    const assignedToUserId = formData.get('assignedToUserId') as string | null
    const assignedContactId = formData.get('assignedContactId') as string | null
    const files = formData.getAll('files') as File[]

    if (!propertyId || !title) {
      return NextResponse.json(
        { error: 'Property ID and title are required' },
        { status: 400 }
      )
    }

    // Verify property exists and user has access
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Check permissions
    if (user.role === 'MANAGER' && property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only create issues for properties you manage' },
        { status: 403 }
      )
    }

    if (user.role === 'OWNER' && property.ownerId !== user.ownerId) {
      return NextResponse.json(
        { error: 'You can only create issues for your own properties' },
        { status: 403 }
      )
    }

    // Create issue
    const issue = await prisma.issue.create({
      data: {
        id: crypto.randomUUID(),
        propertyId,
        title,
        description: description || null,
        status: IssueStatus.OPEN,
        priority: priority as IssuePriority,
        reportedById: user.id,
        assignedToUserId: assignedToUserId || null,
        assignedContactId: assignedContactId || null,
        updatedAt: new Date(),
      },
    })

    // Handle file uploads
    if (files.length > 0) {
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'issues')
      await mkdir(uploadDir, { recursive: true })

      const attachments = await Promise.all(
        files.map(async (file) => {
          if (file.size === 0) return null

          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)

          const timestamp = Date.now()
          const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
          const filename = `${timestamp}-${sanitizedName}`
          const filepath = join(uploadDir, filename)

          await writeFile(filepath, buffer)

          // Determine file type
          const fileType = file.type.startsWith('video/') ? 'video' : 'image'

          return {
            id: crypto.randomUUID(),
            issueId: issue.id,
            fileUrl: `/uploads/issues/${filename}`,
            fileName: file.name,
            fileType,
            fileSize: file.size,
          }
        })
      )

      // Create attachments
      if (attachments.filter(Boolean).length > 0) {
        await prisma.issueAttachment.createMany({
          data: attachments.filter(Boolean) as any[],
        })
      }
    }

    // Fetch issue with attachments
    const issueWithAttachments = await prisma.issue.findUnique({
      where: { id: issue.id },
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
      },
    })

    // Send notifications (non-blocking)
    try {
      const { sendIssueNotification } = await import('@/lib/notifications/service')
      const recipientIds = [property.ownerId]
      
      // If assigned to a contact, notify the contact's owner if applicable
      if (assignedContactId) {
        const contact = await prisma.contact.findUnique({
          where: { id: assignedContactId },
          select: { ownerId: true },
        })
        if (contact?.ownerId && !recipientIds.includes(contact.ownerId)) {
          recipientIds.push(contact.ownerId)
        }
      }

      // Send notification asynchronously (don't wait for it)
      sendIssueNotification(issue.id, 'created', recipientIds).catch((err) => {
        console.error('Failed to send issue creation notification:', err)
      })
    } catch (error) {
      // Don't fail the request if notification fails
      console.error('Notification error:', error)
    }

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      
      executeWorkflows('ISSUE_CREATED', {
        entityType: 'issue',
        entityId: issue.id,
        entityData: issueWithAttachments,
        propertyId,
        ownerId: property.ownerId,
      }).catch((err) => {
        console.error('Failed to execute workflows for issue creation:', err)
      })
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    return NextResponse.json(issueWithAttachments, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create issue:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create issue' },
      { status: 500 }
    )
  }
}

