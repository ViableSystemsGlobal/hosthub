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
    const { success: successCount, ...restResult } = result

    return NextResponse.json({
      success: true,
      ...restResult,
      successCount,
      message: `Executed ${result.executed} AI reports: ${successCount} succeeded, ${result.failed} failed`,
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
 * Body: { type: 'owners' | 'company' }
 * - 'owners': Sends owner-specific reports to all enabled owners
 * - 'company': Sends company-wide report to admins/managers
 */
export async function POST(request: NextRequest) {
  try {
    const { requireAdmin } = await import('@/lib/auth-helpers')
    await requireAdmin(request)

    const body = await request.json().catch(() => ({}))
    const { type = 'owners', period = 'last-week' } = body

    // Map period to internal format
    const periodMap: Record<string, 'daily' | 'weekly' | 'monthly' | 'yesterday' | 'last-week' | 'last-month' | 'current-year'> = {
      'yesterday': 'yesterday',
      'last-week': 'last-week',
      'last-month': 'last-month',
      'current-year': 'current-year',
    }
    const reportPeriod = periodMap[period] || 'last-week'

    if (type === 'company') {
      // Send company-wide report
      const { generateNewsletterReport } = await import('@/lib/reports/ai-newsletter')
      const { generateNewsletterEmailHTML } = await import('@/lib/reports/email-template')
      const { sendEmail } = await import('@/lib/notifications/email')
      const { prisma } = await import('@/lib/prisma')

      // Generate company-wide report (no owner filter)
      let newsletter
      try {
        newsletter = await generateNewsletterReport(reportPeriod, undefined, undefined)
      } catch (error: any) {
        console.error('Failed to generate company-wide AI report:', error)
        let errorMessage = error.message || 'Failed to generate AI report'
        if (errorMessage.includes('x-api-key') || errorMessage.includes('authentication_error') || errorMessage.includes('401')) {
          errorMessage = 'AI API authentication failed. Please check your API key in Settings → AI Providers.'
        } else if (errorMessage.includes('API key not configured')) {
          errorMessage = 'AI API key is not configured. Please add it in Settings → AI Providers.'
        }
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        )
      }

      // Get all admin and manager emails
      const allUsers = await prisma.user.findMany({
        where: {
          role: {
            in: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'],
          },
        },
        select: {
          email: true,
          name: true,
        },
      })

      // Filter out users without email addresses
      const users = allUsers.filter((user) => user.email !== null && user.email !== undefined)

      if (users.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No users with email addresses found for company-wide report',
        }, { status: 400 })
      }

      const emailHTML = await generateNewsletterEmailHTML(newsletter)
      const results = await Promise.allSettled(
        users.map((user) =>
          sendEmail({
            to: user.email!,
            subject: newsletter.subject,
            html: emailHTML,
          })
        )
      )

      const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
      const failed = results.length - sent

      return NextResponse.json({
        success: true,
        executed: users.length,
        successCount: sent,
        failed,
        message: `Sent company-wide report to ${sent} recipients, ${failed} failed`,
        timestamp: new Date().toISOString(),
      })
    } else {
      // For manual testing, send to all enabled owners (ignore nextSend)
      const { executeOwnerAIReportsForTesting } = await import('@/lib/reports/owner-ai-reports')
      const result = await executeOwnerAIReportsForTesting(reportPeriod)
      const { success: successCount, ...restResult } = result

      return NextResponse.json({
        success: true,
        ...restResult,
        successCount,
        message: `Executed ${result.executed} owner AI reports: ${successCount} succeeded, ${result.failed} failed`,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to execute AI reports:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute AI reports' },
      { status: 500 }
    )
  }
}

