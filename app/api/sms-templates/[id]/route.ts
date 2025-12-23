import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET - Get a single SMS template
export async function GET(
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
    const template = await prisma.sMSTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Failed to fetch SMS template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SMS template' },
      { status: 500 }
    )
  }
}

// PUT - Update an SMS template
export async function PUT(
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
    const body = await request.json()
    const { name, message, type, variables, isDefault, isActive } = body

    // Check if template exists
    const existing = await prisma.sMSTemplate.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // If this is set as default, unset other defaults of the same type
    if (isDefault && existing.type === type) {
      await prisma.sMSTemplate.updateMany({
        where: { type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const template = await prisma.sMSTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(message && { message }),
        ...(type && { type }),
        ...(variables !== undefined && { variables }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Failed to update SMS template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update SMS template' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an SMS template
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

    // Check if template exists
    const existing = await prisma.sMSTemplate.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Prevent deletion of default templates
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default template. Set another template as default first.' },
        { status: 400 }
      )
    }

    await prisma.sMSTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete SMS template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete SMS template' },
      { status: 500 }
    )
  }
}

