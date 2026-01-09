import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * POST - Set up cron jobs automatically
 * This endpoint can be called from the admin UI to set up cron jobs
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.status || 401 }
    )
  }

  try {
    const CRON_SECRET = process.env.CRON_SECRET
    const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL

    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: 'CRON_SECRET environment variable is not set' },
        { status: 400 }
      )
    }

    if (!NEXT_PUBLIC_APP_URL) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL environment variable is not set' },
        { status: 400 }
      )
    }

    // Check if we're in a Docker container or have access to crontab
    let setupMethod = 'node'
    const scriptPath = join(process.cwd(), 'scripts', 'setup-cron.js')
    const shellScriptPath = join(process.cwd(), 'scripts', 'setup-cron.sh')

    // Try to run the setup script
    try {
      if (existsSync(scriptPath)) {
        // Set environment variables for the script
        const env = {
          ...process.env,
          CRON_SECRET,
          NEXT_PUBLIC_APP_URL,
        }
        
        const envString = Object.entries(env)
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ')

        // Try Node.js script first
        const output = execSync(
          `${envString} node ${scriptPath}`,
          { 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000 // 30 second timeout
          }
        )

        return NextResponse.json({
          success: true,
          message: 'Cron jobs set up successfully',
          output: output,
          method: 'node'
        })
      } else if (existsSync(shellScriptPath)) {
        // Try shell script as fallback
        const output = execSync(
          `bash ${shellScriptPath}`,
          { 
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, CRON_SECRET, NEXT_PUBLIC_APP_URL },
            timeout: 30000
          }
        )

        return NextResponse.json({
          success: true,
          message: 'Cron jobs set up successfully',
          output: output,
          method: 'bash'
        })
      } else {
        // Manual instructions
        return NextResponse.json({
          success: false,
          message: 'Setup scripts not found. Please set up cron jobs manually.',
          instructions: {
            method1: 'SSH into your server and run: npm run setup:cron',
            method2: 'Or manually edit crontab: crontab -e',
            seeGuide: 'See AUTO_CRON_SETUP.md for detailed instructions'
          }
        }, { status: 404 })
      }
    } catch (execError: any) {
      // If execSync fails, provide manual instructions
      console.error('Cron setup error:', execError)
      
      return NextResponse.json({
        success: false,
        message: 'Automatic setup failed. Please set up cron jobs manually.',
        error: execError.message,
        instructions: {
          method1: 'SSH into your server and run: npm run setup:cron',
          method2: 'Or manually edit crontab: crontab -e',
          seeGuide: 'See AUTO_CRON_SETUP.md for detailed instructions',
          cronJobs: [
            {
              schedule: '0 * * * *',
              command: `curl -X GET "${NEXT_PUBLIC_APP_URL}/api/ai-reports/execute" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null`,
              description: 'AI Reports (every hour)'
            },
            {
              schedule: '0 * * * *',
              command: `curl -X GET "${NEXT_PUBLIC_APP_URL}/api/reminders/run" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null`,
              description: 'Reminders (every hour)'
            },
            {
              schedule: '0 0 * * *',
              command: `curl -X GET "${NEXT_PUBLIC_APP_URL}/api/recurring-tasks/generate" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null`,
              description: 'Recurring Tasks (daily at midnight)'
            },
            {
              schedule: '0 * * * *',
              command: `curl -X GET "${NEXT_PUBLIC_APP_URL}/api/reports/execute" -H "Authorization: Bearer ${CRON_SECRET}" -s -o /dev/null`,
              description: 'Reports (every hour)'
            }
          ]
        }
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Failed to set up cron jobs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set up cron jobs' },
      { status: 500 }
    )
  }
}

/**
 * GET - Check cron job status
 */
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
    // Try to check if cron jobs are installed
    let cronStatus = 'unknown'
    let cronJobs: string[] = []

    try {
      const crontabOutput = execSync('crontab -l 2>/dev/null || echo ""', {
        encoding: 'utf-8',
        timeout: 5000
      })
      
      const lines = crontabOutput.split('\n')
      const hosthubJobs = lines.filter(line => 
        line.includes('HostHub') || 
        line.includes('api/ai-reports/execute') ||
        line.includes('api/reminders/run') ||
        line.includes('api/recurring-tasks/generate') ||
        line.includes('api/reports/execute')
      )

      if (hosthubJobs.length > 0) {
        cronStatus = 'installed'
        cronJobs = hosthubJobs
      } else {
        cronStatus = 'not_installed'
      }
    } catch (e) {
      cronStatus = 'unavailable'
    }

    return NextResponse.json({
      status: cronStatus,
      cronJobs,
      environment: {
        hasCronSecret: !!process.env.CRON_SECRET,
        hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to check cron status' },
      { status: 500 }
    )
  }
}
