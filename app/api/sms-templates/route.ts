import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET - List all SMS templates
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
    // Check if SMSTemplate model is available
    if (!prisma.sMSTemplate) {
      console.error('SMSTemplate model not available. Please restart the server after running: npm run db:generate')
      return NextResponse.json(
        { error: 'SMSTemplate model not available. Please restart the server.' },
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

    const templates = await prisma.sMSTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { type: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json(templates)
  } catch (error: any) {
    console.error('Failed to fetch SMS templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SMS templates' },
      { status: 500 }
    )
  }
}

// POST - Create a new SMS template
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)

    const body = await request.json()
    const { name, message, type, variables, isDefault, isActive } = body

    if (!name || !message || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, message, type' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults of the same type
    if (isDefault) {
      await prisma.sMSTemplate.updateMany({
        where: { type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.sMSTemplate.create({
      data: {
        name,
        message,
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
    console.error('Failed to create SMS template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create SMS template' },
      { status: 500 }
    )
  }
}

