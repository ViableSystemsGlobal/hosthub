import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

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

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        TaskAttachment: true,
        Property: {
          select: {
            ownerId: true,
            managerId: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions
    const canAccess =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && task.Property.managerId === user.id) ||
      (user.role === 'OWNER' && task.Property.ownerId === user.ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(task.TaskAttachment)
  } catch (error: any) {
    console.error('Failed to fetch task attachments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task attachments' },
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

    // Only operations, managers, and admins can upload attachments
    if (!['OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        Property: {
          select: {
            managerId: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && task.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only upload attachments for properties you manage' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'tasks')
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
          taskId: id,
          fileUrl: `/uploads/tasks/${filename}`,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          uploadedById: user.id,
        }
      })
    )

    // Create attachments
    const validAttachments = attachments.filter(Boolean) as any[]
    if (validAttachments.length > 0) {
      await prisma.taskAttachment.createMany({
        data: validAttachments,
      })
    }

    // Return updated task with attachments
    const updatedTask = await prisma.task.findUnique({
      where: { id },
      include: {
        TaskAttachment: {
          include: {
            UploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedTask, { status: 201 })
  } catch (error: any) {
    console.error('Failed to add attachments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add attachments' },
      { status: 500 }
    )
  }
}

