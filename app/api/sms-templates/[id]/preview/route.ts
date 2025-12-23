import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { replaceVariables } from '@/lib/notifications/sms-template-renderer'

// POST - Preview an SMS template with sample data
export async function POST(
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
    const { variables: sampleVariables } = await request.json()

    const template = await prisma.sMSTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Replace variables in message
    const vars = sampleVariables || {}
    const previewMessage = replaceVariables(template.message, vars)

    return NextResponse.json({
      message: previewMessage,
    })
  } catch (error: any) {
    console.error('Failed to preview SMS template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview SMS template' },
      { status: 500 }
    )
  }
}

