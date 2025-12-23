import { NextRequest, NextResponse } from 'next/server'
import { executeOwnerAIReports, executeOwnerAIReportsForTesting } from '@/lib/reports/owner-ai-reports'

/**
 * Execute owner AI reports
 * This endpoint should be called by a cron job (e.g., hourly)
 * 
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/ai-reports/execute",
 *     "schedule": "0 * * * *" // Every hour
 *   }]
 * }
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

    const result = await executeOwnerAIReports()

    return NextResponse.json({
      success: true,
      ...result,
      message: `Executed ${result.executed} AI reports: ${result.success} succeeded, ${result.failed} failed`,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Failed to execute owner AI reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute owner AI reports' },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for manual execution (admin only)
 * Uses test mode which sends to all enabled owners regardless of nextSend time
 */
export async function POST(request: NextRequest) {
  try {
    const { requireAdmin } = await import('@/lib/auth-helpers')
    await requireAdmin(request)

    // For manual testing, send to all enabled owners (ignore nextSend)
    const result = await executeOwnerAIReportsForTesting()

    return NextResponse.json({
      success: true,
      ...result,
      message: `Executed ${result.executed} AI reports: ${result.success} succeeded, ${result.failed} failed`,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to execute owner AI reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute owner AI reports' },
      { status: 500 }
    )
  }
}

