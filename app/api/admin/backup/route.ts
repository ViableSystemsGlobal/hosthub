import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * GET - Create a backup of all database data
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
    // Fetch all data from all tables
    const backup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
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
    }

    // Return as JSON download
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hosthub-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error: any) {
    console.error('Backup error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create backup' },
      { status: 500 }
    )
  }
}
