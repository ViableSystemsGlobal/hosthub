import { NextRequest, NextResponse } from 'next/server'
import { executeScheduledReports } from '@/lib/reports/newsletter-sender'

/**
 * Execute scheduled reports
 * Can be called by cron job or manually
 */
export async function GET(request: NextRequest) {
  try {
    // Check for cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const providedSecret = authHeader?.replace('Bearer ', '')

    // Allow if no secret is set (development) or if secret matches
    if (cronSecret && providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await executeScheduledReports()

    return NextResponse.json({
      success: true,
      ...result,
      message: `Executed ${result.executed} reports: ${result.success} succeeded, ${result.failed} failed`,
    })
  } catch (error: any) {
    console.error('Failed to execute scheduled reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute scheduled reports' },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for manual execution (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { requireAdmin } = await import('@/lib/auth-helpers')
    await requireAdmin(request)

    const result = await executeScheduledReports()

    return NextResponse.json({
      success: true,
      ...result,
      message: `Executed ${result.executed} reports: ${result.success} succeeded, ${result.failed} failed`,
    })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to execute scheduled reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute scheduled reports' },
      { status: 500 }
    )
  }
}

