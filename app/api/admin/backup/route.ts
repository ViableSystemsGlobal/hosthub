import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'

interface BackupFile {
  path: string // Relative path like "uploads/receipts/123.png"
  name: string
  data: string // Base64 encoded file content
  mimeType: string
}

// Get mime type from file extension
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

// Recursively scan directory for files
async function scanDirectory(dirPath: string, basePath: string): Promise<BackupFile[]> {
  const files: BackupFile[] = []
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      const relativePath = join(basePath, entry.name)
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath, relativePath)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        try {
          const fileContent = await readFile(fullPath)
          const base64Data = fileContent.toString('base64')
          
          files.push({
            path: relativePath,
            name: entry.name,
            data: base64Data,
            mimeType: getMimeType(entry.name),
          })
        } catch (fileError) {
          console.error(`Failed to read file ${fullPath}:`, fileError)
          // Continue with other files
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    console.log(`Directory ${dirPath} not accessible:`, error)
  }
  
  return files
}

/**
 * GET - Create a backup of all database data and files
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
    // Scan uploads directory for files
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    const uploadedFiles = await scanDirectory(uploadsDir, 'uploads')
    
    console.log(`Found ${uploadedFiles.length} files to backup`)

    // Fetch all data from all tables
    const backup = {
      version: '1.1', // Updated version to indicate files support
      createdAt: new Date().toISOString(),
      includesFiles: true,
      data: {
        // Core entities
        // Users must be backed up separately to include non-owner users (e.g., managers)
        users: await prisma.user.findMany({
          where: {
            role: { not: 'SUPER_ADMIN' }, // Exclude super admin from backup
          },
        }),
        owners: await prisma.owner.findMany({
          include: {
            OwnerWallet: true,
            User: true,
          },
        }),
        properties: await prisma.property.findMany(),
        bookings: await prisma.booking.findMany(),
        expenses: await prisma.expense.findMany(),
        statements: await prisma.statement.findMany({
          include: {
            StatementLine: true,
          },
        }),
        issues: await prisma.issue.findMany({
          include: {
            IssueAttachment: true,
            IssueComment: true,
          },
        }),
        tasks: await prisma.task.findMany({
          include: {
            TaskAttachment: true,
            TaskChecklist: true,
          },
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
          include: {
            History: true,
          },
        }),
        workflows: await prisma.workflowRule.findMany(),
        workflowExecutions: await prisma.workflowExecution.findMany(),
        conversations: await prisma.conversation.findMany({
          include: {
            Message: true,
          },
        }),
        notifications: await prisma.notification.findMany(),
        aiInsightCache: await prisma.aiInsightCache.findMany(),
        // Settings and templates (exclude sensitive data)
        emailTemplates: await prisma.emailTemplate.findMany(),
        smsTemplates: await prisma.sMSTemplate.findMany(),
        settings: await prisma.setting.findMany({
          where: {
            // Exclude sensitive settings
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
      // Include uploaded files (images, receipts, logos, etc.)
      files: uploadedFiles,
    }

    // Return as JSON download
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hosthub-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Backup error:', error)
    return NextResponse.json(
      { error: err.message || 'Failed to create backup' },
      { status: 500 }
    )
  }
}
