import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

const DEFAULT_SMS_TEMPLATES = [
  {
    name: 'Booking Confirmation',
    type: 'booking_confirmation',
    message: `Hi {{guestName}}, your booking at {{propertyName}} is confirmed! Check-in: {{checkInDate}}, Check-out: {{checkOutDate}}. Total: {{currency}} {{totalPayout}}. Booking ID: {{bookingId}}`,
    variables: ['guestName', 'propertyName', 'checkInDate', 'checkOutDate', 'nights', 'totalPayout', 'currency', 'bookingId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Booking Reminder',
    type: 'booking_reminder',
    message: `Reminder: Your stay at {{propertyName}} starts {{checkInDate}}. Check-out: {{checkOutDate}} ({{nights}} nights). Booking ID: {{bookingId}}`,
    variables: ['guestName', 'propertyName', 'checkInDate', 'checkOutDate', 'nights', 'bookingId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Statement Notification',
    type: 'statement',
    message: `Hi {{ownerName}}, your statement for {{periodStart}} to {{periodEnd}} is ready. Revenue: {{currency}} {{totalRevenue}}, Expenses: {{currency}} {{totalExpenses}}, Net: {{currency}} {{netBalance}}`,
    variables: ['ownerName', 'periodStart', 'periodEnd', 'totalRevenue', 'totalExpenses', 'commission', 'netBalance', 'currency'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Issue Notification',
    type: 'issue_notification',
    message: `New issue at {{propertyName}}: {{issueTitle}}. Status: {{issueStatus}}, Priority: {{issuePriority}}. Issue ID: {{issueId}}`,
    variables: ['ownerName', 'propertyName', 'issueTitle', 'issueDescription', 'issueStatus', 'issuePriority', 'issueId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Payout Notification',
    type: 'payout_notification',
    message: `Hi {{ownerName}}, payout of {{currency}} {{amount}} processed on {{payoutDate}}. Payout ID: {{payoutId}}. Funds will arrive in 3-5 business days.`,
    variables: ['ownerName', 'amount', 'currency', 'payoutDate', 'payoutId'],
    isDefault: true,
    isActive: true,
  },
  {
    name: 'Task Assignment',
    type: 'task_assignment',
    message: `New task assigned: {{taskTitle}} at {{propertyName}}. Due: {{taskDueDate}}. Task ID: {{taskId}}`,
    variables: ['ownerName', 'propertyName', 'taskTitle', 'taskDescription', 'taskDueDate', 'taskId'],
    isDefault: true,
    isActive: true,
  },
]

// POST - Seed default SMS templates
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

    for (const template of DEFAULT_SMS_TEMPLATES) {
      // Check if template of this type already exists
      const existing = await prisma.sMSTemplate.findFirst({
        where: {
          type: template.type,
          isDefault: true,
        },
      })

      if (existing) {
        skipped.push(template.name)
        continue
      }

      const createdTemplate = await prisma.sMSTemplate.create({
        data: {
          name: template.name,
          message: template.message,
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
      message: `Created ${created.length} SMS templates. ${skipped.length} already existed.`,
    })
  } catch (error: any) {
    console.error('Failed to seed SMS templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to seed SMS templates' },
      { status: 500 }
    )
  }
}

