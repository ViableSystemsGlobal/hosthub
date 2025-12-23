import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { checkNotificationsAndAI } from '@/lib/diagnostics/check-notifications-ai'

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
    const results = await checkNotificationsAndAI()
    
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      warnings: results.filter((r) => r.status === 'warning').length,
      failed: results.filter((r) => r.status === 'fail').length,
    }

    return NextResponse.json({
      summary,
      results,
    })
  } catch (error: any) {
    console.error('Diagnostic check failed:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run diagnostics' },
      { status: 500 }
    )
  }
}

