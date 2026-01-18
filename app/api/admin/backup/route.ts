import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdir, readFile, stat, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs'

const execAsync = promisify(exec)

/**
 * GET - Create a backup using pg_dump + zip archive
 * Returns a .tar.gz or .zip file with database dump + uploads folder
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Unauthorized' },
      { status: err.status || 401 }
    )
  }

  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      )
    }

    // Parse DATABASE_URL to extract connection details
    // Format: postgresql://user:password@host:port/database
    const url = new URL(dbUrl)
    const dbUser = url.username
    const dbPassword = url.password
    const dbHost = url.hostname
    const dbPort = url.port || '5432'
    const dbName = url.pathname.slice(1) // Remove leading /

    // Create temp directory for backup
    const tempDir = join(tmpdir(), `hosthub-backup-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    const dumpFile = join(tempDir, 'database.sql')
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    const backupArchive = join(tempDir, 'backup.tar.gz')

    try {
      // Step 1: Copy uploads directory to temp first (needed for both pg_dump and JSON fallback)
      const tempUploads = join(tempDir, 'uploads')
      await execAsync(`cp -r "${uploadsDir}" "${tempUploads}" 2>/dev/null || mkdir -p "${tempUploads}"`)
      console.log('Uploads directory copied')

      // Step 2: Create database dump using pg_dump
      // Use -F p (plain) format for compatibility with psql restore
      let usedJsonFallback = false
      const pgDumpCmd = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p -f "${dumpFile}"`
      
      try {
        await execAsync(pgDumpCmd)
        console.log('Database dump created successfully (plain SQL format)')
      } catch (pgDumpError: any) {
        // If pg_dump is not available, fall back to JSON export
        console.warn('pg_dump not available, falling back to JSON export:', pgDumpError.message)
        usedJsonFallback = true
        
        // Export as JSON instead
        const backup = {
          version: '2.0',
          createdAt: new Date().toISOString(),
          format: 'json',
          data: {
            users: await prisma.user.findMany({
              where: { role: { not: 'SUPER_ADMIN' } },
            }),
            owners: await prisma.owner.findMany({
              include: { OwnerWallet: true, User: true },
            }),
            properties: await prisma.property.findMany(),
            bookings: await prisma.booking.findMany(),
            expenses: await prisma.expense.findMany(),
            statements: await prisma.statement.findMany({
              include: { StatementLine: true },
            }),
            issues: await prisma.issue.findMany({
              include: { IssueAttachment: true, IssueComment: true },
            }),
            tasks: await prisma.task.findMany({
              include: { TaskAttachment: true, TaskChecklist: true },
            }),
            documents: await prisma.document.findMany(),
            contacts: await prisma.contact.findMany(),
            guestContacts: await prisma.guestContact.findMany(),
            payouts: await prisma.payout.findMany(),
            ownerTransactions: await prisma.ownerTransaction.findMany(),
            recurringTasks: await prisma.recurringTask.findMany(),
            reports: await prisma.report.findMany(),
            cleaningChecklists: await prisma.cleaningChecklist.findMany(),
            electricityMeterReadings: await prisma.electricityMeterReading.findMany(),
            electricityAlerts: await prisma.electricityAlert.findMany(),
            inventoryItems: await prisma.inventoryItem.findMany({
              include: { History: true },
            }),
            workflows: await prisma.workflowRule.findMany(),
            workflowExecutions: await prisma.workflowExecution.findMany(),
            conversations: await prisma.conversation.findMany({
              include: { Message: true },
            }),
            notifications: await prisma.notification.findMany(),
            aiInsightCache: await prisma.aiInsightCache.findMany(),
            emailTemplates: await prisma.emailTemplate.findMany(),
            smsTemplates: await prisma.sMSTemplate.findMany(),
            settings: await prisma.setting.findMany({
              where: {
                key: {
                  notIn: [
                    'DEYWURO_PASSWORD',
                    'SMTP_PASSWORD',
                    'TWILIO_AUTH_TOKEN',
                    'OPENAI_API_KEY',
                    'ANTHROPIC_API_KEY',
                    'GEMINI_API_KEY',
                  ],
                },
              },
            }),
          },
        }

        const jsonFile = join(tempDir, 'database.json')
        await writeFile(jsonFile, JSON.stringify(backup, null, 2))
        console.log('JSON backup created at:', jsonFile)
      }

      // Step 3: Create archive (tar.gz or zip)
      let archivePath = backupArchive
      let archiveType = 'application/gzip'
      let archiveExt = 'tar.gz'

      // Determine which database file to archive (sql or json)
      const dbFile = usedJsonFallback ? 'database.json' : 'database.sql'
      console.log('Creating archive with:', dbFile)

      // Try tar.gz first, fall back to zip
      const createArchive = `cd "${tempDir}" && tar -czf "${backupArchive}" ${dbFile} uploads/ 2>/dev/null || (cd "${tempDir}" && zip -r "${backupArchive.replace('.tar.gz', '.zip')}" ${dbFile} uploads/ 2>/dev/null && echo "zip") || echo "failed"`
      
      const archiveResult = await execAsync(createArchive)
      console.log('Archive result:', archiveResult.stdout)
      
      if (archiveResult.stdout.includes('zip') || !require('fs').existsSync(backupArchive)) {
        archivePath = backupArchive.replace('.tar.gz', '.zip')
        archiveType = 'application/zip'
        archiveExt = 'zip'
      }

      if (!fs.existsSync(archivePath)) {
        throw new Error('Failed to create archive. Please ensure tar or zip is available.')
      }
      
      console.log('Archive created at:', archivePath)

      // Step 4: Read archive and return as download
      const archiveBuffer = await readFile(archivePath)
      
      // Clean up temp files
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {})

      const filename = `hosthub-backup-${new Date().toISOString().split('T')[0]}.${archiveExt}`

      return new NextResponse(archiveBuffer, {
        headers: {
          'Content-Type': archiveType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': archiveBuffer.length.toString(),
        },
      })
    } catch (error: unknown) {
      // Clean up on error
      await execAsync(`rm -rf "${tempDir}"`).catch(() => {})
      throw error
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Backup error:', error)
    return NextResponse.json(
      { error: err.message || 'Failed to create backup' },
      { status: 500 }
    )
  }
}
