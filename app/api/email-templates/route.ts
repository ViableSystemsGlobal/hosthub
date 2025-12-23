import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET - List all email templates
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.status || 401 }
    )
  }

  try {
    // Check if EmailTemplate model is available
    if (!prisma.emailTemplate) {
      console.error('EmailTemplate model not available. Please restart the server after running: npm run db:generate')
      return NextResponse.json(
        { error: 'EmailTemplate model not available. Please restart the server.' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const isActiveParam = searchParams.get('isActive')

    const where: any = {}
    if (type) where.type = type
    if (isActiveParam !== null && isActiveParam !== '') {
      where.isActive = isActiveParam === 'true'
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { type: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(templates)
  } catch (error: any) {
    console.error('Failed to fetch email templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch email templates' },
      { status: 500 }
    )
  }
}

// POST - Create a new email template
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)

    const body = await request.json()
    const { name, subject, body: templateBody, type, variables, isDefault, isActive } = body

    if (!name || !subject || !templateBody || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, body, type' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults of the same type
    if (isDefault) {
      await prisma.emailTemplate.updateMany({
        where: { type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name,
        subject,
        body: templateBody,
        type,
        variables: variables || [],
        isDefault: isDefault || false,
        isActive: isActive !== undefined ? isActive : true,
        createdById: user.id,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { error: error.message || 'Unauthorized' },
        { status: error.status || 401 }
      )
    }
    console.error('Failed to create email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create email template' },
      { status: 500 }
    )
  }
}

