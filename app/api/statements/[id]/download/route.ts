import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { StatementPDF } from '@/components/pdf/statement-pdf'

// Fetch logo from settings (direct database access)
async function getLogoUrl(): Promise<string | null> {
  try {
    const logoSetting = await prisma.setting.findUnique({
      where: { key: 'APP_LOGO' },
    })
    return logoSetting?.value || null
  } catch (error) {
    console.error('Failed to fetch logo:', error)
  }
  return null
}

// Fetch theme color from settings
async function getThemeColor(): Promise<string> {
  try {
    const themeSetting = await prisma.setting.findUnique({
      where: { key: 'THEME_COLOR' },
    })
    return themeSetting?.value || '#f97316' // Default orange
  } catch (error) {
    console.error('Failed to fetch theme color:', error)
  }
  return '#f97316' // Default orange
}

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
    if (user.role === 'OWNER' && statement.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Map relation names for PDF component (expects lowercase)
    const statementForPDF = {
      ...statement,
      owner: statement.Owner,
      statementLines: statement.StatementLine,
    }

    // Fetch logo URL and theme color
    let logoUrl = await getLogoUrl()
    const themeColor = await getThemeColor()
    
    // Convert relative logo path to absolute file path for PDF rendering
    if (logoUrl && logoUrl.startsWith('/')) {
      const path = require('path')
      const fs = require('fs')
      const publicPath = path.join(process.cwd(), 'public', logoUrl)
      if (fs.existsSync(publicPath)) {
        logoUrl = publicPath
      }
    }

    // Generate PDF on demand
    const pdfBuffer = await renderToBuffer(
      React.createElement(StatementPDF, { statement: statementForPDF, logoUrl, themeColor })
    )

    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

