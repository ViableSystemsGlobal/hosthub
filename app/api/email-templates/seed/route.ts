import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const DEFAULT_TEMPLATES = [
  {
    name: 'Booking Confirmation',
    type: 'booking_confirmation',
    subject: 'Booking Confirmation - {{propertyName}}',
    body: `Dear {{guestName}},

Thank you for your booking! We're excited to host you at {{propertyName}}.

Booking Details:
- Check-in: {{checkInDate}}
- Check-out: {{checkOutDate}}
- Nights: {{nights}}
- Total Amount: {{currency}} {{totalPayout}}

Booking ID: {{bookingId}}

We look forward to welcoming you!

Best regards,
HostHub Team`,
    variables: ['guestName', 'propertyName', 'checkInDate', 'checkOutDate', 'nights', 'totalPayout', 'currency', 'bookingId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Booking Reminder',
    type: 'booking_reminder',
    subject: 'Reminder: Your stay at {{propertyName}} starts {{checkInDate}}',
    body: `Dear {{guestName}},

This is a friendly reminder that your stay at {{propertyName}} is coming up soon!

Check-in: {{checkInDate}}
Check-out: {{checkOutDate}}
Duration: {{nights}} nights

Booking ID: {{bookingId}}

We're looking forward to hosting you!

Best regards,
HostHub Team`,
    variables: ['guestName', 'propertyName', 'checkInDate', 'checkOutDate', 'nights', 'bookingId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Statement Notification',
    type: 'statement',
    subject: 'Your Statement for {{periodStart}} to {{periodEnd}}',
    body: `Dear {{ownerName}},

Your statement for the period {{periodStart}} to {{periodEnd}} is now available.

Summary:
- Total Revenue: {{currency}} {{totalRevenue}}
- Total Expenses: {{currency}} {{totalExpenses}}
- Commission: {{currency}} {{commission}}
- Net Balance: {{currency}} {{netBalance}}

Please log in to your portal to view the full statement.

Best regards,
HostHub Team`,
    variables: ['ownerName', 'periodStart', 'periodEnd', 'totalRevenue', 'totalExpenses', 'commission', 'netBalance', 'currency'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Issue Notification',
    type: 'issue_notification',
    subject: 'New Issue Reported: {{issueTitle}}',
    body: `Dear {{ownerName}},

A new issue has been reported for {{propertyName}}.

Issue Details:
- Title: {{issueTitle}}
- Description: {{issueDescription}}
- Status: {{issueStatus}}
- Priority: {{issuePriority}}

Issue ID: {{issueId}}

We'll keep you updated on the progress.

Best regards,
HostHub Team`,
    variables: ['ownerName', 'propertyName', 'issueTitle', 'issueDescription', 'issueStatus', 'issuePriority', 'issueId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Payout Notification',
    type: 'payout_notification',
    subject: 'Payout Processed - {{currency}} {{amount}}',
    body: `Dear {{ownerName}},

Your payout has been processed successfully.

Payout Details:
- Amount: {{currency}} {{amount}}
- Date: {{payoutDate}}
- Payout ID: {{payoutId}}

The funds should appear in your account within 3-5 business days.

Best regards,
HostHub Team`,
    variables: ['ownerName', 'amount', 'currency', 'payoutDate', 'payoutId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Task Assignment',
    type: 'task_assignment',
    subject: 'New Task Assigned: {{taskTitle}}',
    body: `Hello,

A new task has been assigned to you.

Task Details:
- Title: {{taskTitle}}
- Property: {{propertyName}}
- Due Date: {{dueDate}}
- Type: {{taskType}}

Task ID: {{taskId}}

Please complete this task by the due date.

Best regards,
HostHub Team`,
    variables: ['taskTitle', 'propertyName', 'dueDate', 'taskType', 'taskId'],
    isDefault: true,
    isActive: true,
  },
]

// POST - Seed default email templates
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
    const created = []
    const skipped = []

    for (const template of DEFAULT_TEMPLATES) {
      // Check if template of this type already exists
      const existing = await prisma.emailTemplate.findFirst({
        where: {
          type: template.type,
          isDefault: true,
        },
      })

      if (existing) {
        skipped.push(template.name)
        continue
      }

      const createdTemplate = await prisma.emailTemplate.create({
        data: {
          name: template.name,
          subject: template.subject,
          body: template.body,
          type: template.type,
          variables: template.variables,
          isDefault: template.isDefault,
          isActive: template.isActive,
        },
      })

      created.push(createdTemplate.name)
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message: `Created ${created.length} templates. ${skipped.length} already existed.`,
    })
  } catch (error: any) {
    console.error('Failed to seed email templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to seed email templates' },
      { status: 500 }
    )
  }
}

