import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

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
      (user.role === 'OWNER' && issue.Property.ownerId === user.ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

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
          issueId: id,
          fileUrl: `/uploads/issues/${filename}`,
          fileName: file.name,
          fileType,
          fileSize: file.size,
        }
      })
    )

    // Create attachments
    const validAttachments = attachments.filter(Boolean) as any[]
    if (validAttachments.length > 0) {
      await prisma.issueAttachment.createMany({
        data: validAttachments,
      })
    }

    // Return updated issue with attachments
    const updatedIssue = await prisma.issue.findUnique({
      where: { id },
      include: {
        IssueAttachment: true,
      },
    })

    return NextResponse.json(updatedIssue, { status: 201 })
  } catch (error: any) {
    console.error('Failed to add attachments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add attachments' },
      { status: 500 }
    )
  }
}

