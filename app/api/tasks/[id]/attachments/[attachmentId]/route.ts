import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only operations, managers, and admins can delete attachments
    if (!['OPERATIONS', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, attachmentId } = await params

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        Task: {
          include: {
            Property: {
              select: {
                managerId: true,
              },
            },
          },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.taskId !== id) {
      return NextResponse.json({ error: 'Attachment does not belong to this task' }, { status: 400 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && attachment.Task.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete attachments for properties you manage' },
        { status: 403 }
      )
    }

    // Delete file from filesystem
    try {
      const filepath = join(process.cwd(), 'public', attachment.fileUrl)
      await unlink(filepath)
    } catch (error) {
      // File might not exist, continue with database deletion
      console.warn('Failed to delete file from filesystem:', error)
    }

    // Delete from database
    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete attachment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}

