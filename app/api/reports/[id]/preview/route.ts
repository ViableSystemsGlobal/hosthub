import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { generateNewsletterReport } from '@/lib/reports/ai-newsletter'
import { prisma } from '@/lib/prisma'
import { ReportSchedule } from '@prisma/client'

/**
 * Preview a scheduled report before it's sent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    // @ts-ignore - Report model may not be in types yet
    const reportModel = (prisma as any).report
    if (!reportModel) {
      return NextResponse.json({ error: 'Report model not available. Please restart the server.' }, { status: 500 })
    }
    const report = await reportModel.findUnique({
      where: { id },
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Determine period from schedule
    let period: 'daily' | 'weekly' | 'monthly' = 'daily'
    switch (report.schedule) {
      case ReportSchedule.DAILY:
        period = 'daily'
        break
      case ReportSchedule.WEEKLY:
        period = 'weekly'
        break
      case ReportSchedule.MONTHLY:
        period = 'monthly'
        break
      default:
        period = 'daily'
    }

    // Generate newsletter report
    const newsletter = await generateNewsletterReport(period, report.filters as any)

    return NextResponse.json(newsletter)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to preview report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview report' },
      { status: 500 }
    )
  }
}

