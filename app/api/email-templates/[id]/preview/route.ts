import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// POST - Preview an email template with sample data
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

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Replace variables in subject and body
    let previewSubject = template.subject
    let previewBody = template.body

    const vars = sampleVariables || {}
    Object.keys(vars).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      previewSubject = previewSubject.replace(regex, vars[key])
      previewBody = previewBody.replace(regex, vars[key])
    })

    return NextResponse.json({
      subject: previewSubject,
      body: previewBody,
    })
  } catch (error: any) {
    console.error('Failed to preview email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview email template' },
      { status: 500 }
    )
  }
}

