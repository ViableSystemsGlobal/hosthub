import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        Property: {
          select: { id: true, name: true },
        },
        Owner: {
          select: { id: true, name: true },
        },
        Booking: {
          select: { id: true, guestName: true, checkInDate: true },
        },
        Expense: {
          select: { id: true, description: true, date: true },
        },
        User: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Role-based access control
    if (user.role === 'OWNER' && document.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else if (user.role === 'MANAGER') {
      if (document.propertyId) {
        const property = await prisma.property.findUnique({
          where: { id: document.propertyId },
        })
        if (!property || property.managerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    return NextResponse.json(document)
  } catch (error: any) {
    console.error('Failed to fetch document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins, managers, and finance can delete documents
    if (user.role === 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const document = await prisma.document.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify access for managers
    if (user.role === 'MANAGER') {
      if (document.propertyId) {
        const property = await prisma.property.findUnique({
          where: { id: document.propertyId },
        })
        if (!property || property.managerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    // Delete file from filesystem
    try {
      const filepath = join(process.cwd(), 'public', document.fileUrl)
      await unlink(filepath)
    } catch (fileError) {
      console.warn('Failed to delete file:', fileError)
      // Continue with database deletion even if file deletion fails
    }

    // Delete document record
    await prisma.document.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete document' },
      { status: 500 }
    )
  }
}

