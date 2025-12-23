import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET - Get a single email template
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
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Failed to fetch email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch email template' },
      { status: 500 }
    )
  }
}

// PUT - Update an email template
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
    const { name, subject, body: templateBody, type, variables, isDefault, isActive } = body

    // Check if template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // If this is set as default, unset other defaults of the same type
    if (isDefault && existing.type === type) {
      await prisma.emailTemplate.updateMany({
        where: { type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(subject && { subject }),
        ...(templateBody && { body: templateBody }),
        ...(type && { type }),
        ...(variables !== undefined && { variables }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(template)
  } catch (error: any) {
    console.error('Failed to update email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update email template' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an email template
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
    const existing = await prisma.emailTemplate.findUnique({
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

    await prisma.emailTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete email template' },
      { status: 500 }
    )
  }
}

