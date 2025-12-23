import { NextRequest, NextResponse } from 'next/server'
import { generateRecurringTasks } from '@/lib/recurring-tasks/engine'
import { requireAdmin } from '@/lib/auth-helpers'

/**
 * Generate tasks from recurring tasks
 * This endpoint should be called by a cron job (e.g., daily)
 * 
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/recurring-tasks/generate",
 *     "schedule": "0 0 * * *" // Daily at midnight
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // For cron jobs, we might want to allow a secret token instead of admin auth
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Allow cron job with secret token
    } else {
      // Otherwise require admin
      await requireAdmin(request)
    }

    const result = await generateRecurringTasks()

    return NextResponse.json({
      success: true,
      generated: result.generated,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to generate recurring tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate recurring tasks' },
      { status: 500 }
    )
  }
}

// Also allow GET for easy manual triggering (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const result = await generateRecurringTasks()

    return NextResponse.json({
      success: true,
      generated: result.generated,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Failed to generate recurring tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate recurring tasks' },
      { status: 500 }
    )
  }
}

