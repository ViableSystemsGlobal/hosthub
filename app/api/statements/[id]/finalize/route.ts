import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { StatementStatus, TransactionType } from '@prisma/client'
import { triggerStatementReadyNotification } from '@/lib/notifications/service'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAdmin(request)
    
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

    if (statement.status === StatementStatus.FINALIZED) {
      return NextResponse.json(
        { error: 'Statement already finalized' },
        { status: 400 }
      )
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update statement status
      const updatedStatement = await tx.statement.update({
        where: { id },
        data: {
          status: StatementStatus.FINALIZED,
          finalizedAt: new Date(),
          finalizedById: user.id,
        },
        include: {
          Owner: true,
          StatementLine: true,
        },
      })

      // Create wallet transaction
      const transaction = await tx.ownerTransaction.create({
        data: {
          id: crypto.randomUUID(),
          ownerId: statement.ownerId,
          type: TransactionType.STATEMENT_NET,
          amount: statement.netToOwner,
          currency: statement.displayCurrency,
          referenceId: statement.id,
          notes: `Statement ${statement.periodStart.toISOString().split('T')[0]} to ${statement.periodEnd.toISOString().split('T')[0]}`,
        },
      })

      // Update wallet balance
      const allTransactions = await tx.ownerTransaction.findMany({
        where: { ownerId: statement.ownerId },
      })

      const newBalance = allTransactions.reduce((sum, tx) => sum + tx.amount, 0)

      await tx.ownerWallet.upsert({
        where: { ownerId: statement.ownerId },
        update: { currentBalance: newBalance },
        create: {
          id: crypto.randomUUID(),
          ownerId: statement.ownerId,
          currentBalance: newBalance,
          commissionsPayable: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Save PDF (in production, save to S3 or similar)
      const pdfFilename = `statement-${statement.id}.pdf`
      const pdfPath = `/uploads/statements/${pdfFilename}`
      
      // Update statement with PDF URL
      const finalStatement = await tx.statement.update({
        where: { id },
        data: {
          pdfUrl: pdfPath,
        },
        include: {
          Owner: true,
          StatementLine: true,
        },
      })

      // Generate PDF - map relation names for PDF component
      const statementForPDF = {
        ...finalStatement,
        owner: finalStatement.Owner,
        statementLines: finalStatement.StatementLine,
      }
      
      // Fetch logo URL
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

      const pdfBuffer = await renderToBuffer(
        <StatementPDF statement={statementForPDF} logoUrl={logoUrl} themeColor={themeColor} />
      )

      return { statement: finalStatement, pdfBuffer }
    })

    // Trigger notification
    try {
      await triggerStatementReadyNotification(id)
    } catch (error) {
      console.error('Failed to trigger notification:', error)
      // Don't fail the request if notification fails
    }

    // Return PDF as response
    return new NextResponse(result.pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${id}.pdf"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to finalize statement' },
      { status: 500 }
    )
  }
}
