import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

// GET - Get a single statement
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

    const statement = await prisma.statement.findUnique({
      where: { id },
      include: {
        Owner: true,
        StatementLine: true,
      },
    })

    if (!statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }

    // Owners can only see their own statements
    if (user.role === 'OWNER') {
      if (!user.ownerId || statement.ownerId !== user.ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(statement)
  } catch (error: any) {
    console.error('Failed to fetch statement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch statement' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a statement (only DRAFT statements can be deleted)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.status || 401 }
    )
  }

  try {
    const { id } = await params

    // Check if statement exists and is DRAFT
    const statement = await prisma.statement.findUnique({
      where: { id },
    })

    if (!statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }

    // Only allow deletion of DRAFT statements
    if (statement.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT statements can be deleted. Finalized statements cannot be deleted.' },
        { status: 400 }
      )
    }

    // Delete statement (StatementLines will be cascade deleted)
    await prisma.statement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Statement deleted successfully' })
  } catch (error: any) {
    console.error('Failed to delete statement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete statement' },
      { status: 500 }
    )
  }
}
