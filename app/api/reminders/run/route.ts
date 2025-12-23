import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { runAllReminders } from '@/lib/reminders/service'

/**
 * API route to trigger reminder checks
 * Can be called manually by admins or by a cron job
 * 
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/reminders/run",
 *     "schedule": "0 * * * *" // Every hour
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Allow admin access or cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // If cron secret is set, check for it
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Allow cron access
    } else {
      // Otherwise require admin
      await requireAdmin(request)
    }

    const results = await runAllReminders()

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error running reminders:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run reminders',
      },
      { status: 500 }
    )
  }
}

// Also allow GET for easy manual triggering (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const results = await runAllReminders()

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error running reminders:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run reminders',
      },
      { status: 500 }
    )
  }
}

