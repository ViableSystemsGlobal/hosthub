/**
 * SMS Template Renderer
 * Handles rendering SMS templates with variable replacement
 */

import { prisma } from '@/lib/prisma'

/**
 * Replace variables in SMS message text
 * Variables are in the format {{variableName}}
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value || '')
  }
  return result
}

/**
 * Render an SMS template by ID with provided variables
 */
export async function renderSMSTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<{ message: string } | null> {
  try {
    const template = await prisma.sMSTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template || !template.isActive) {
      return null
    }

    const message = replaceVariables(template.message, variables)
    return { message }
  } catch (error) {
    console.error('Failed to render SMS template:', error)
    return null
  }
}

/**
 * Render the default SMS template for a given type with provided variables
 */
export async function renderSMSTemplateByType(
  type: string,
  variables: Record<string, string>
): Promise<{ message: string } | null> {
  try {
    const template = await prisma.sMSTemplate.findFirst({
      where: {
        type,
        isDefault: true,
        isActive: true,
      },
    })

    if (!template) {
      return null
    }

    const message = replaceVariables(template.message, variables)
    return { message }
  } catch (error) {
    console.error('Failed to render SMS template by type:', error)
    return null
  }
}

/**
 * Get expected variables for a given template type
 */
export function getSMSTemplateVariables(type: string): string[] {
  const variableMap: Record<string, string[]> = {
    booking_confirmation: [
      'guestName',
      'propertyName',
      'checkInDate',
      'checkOutDate',
      'nights',
      'totalPayout',
      'currency',
      'bookingId',
    ],
    booking_reminder: [
      'guestName',
      'propertyName',
      'checkInDate',
      'checkOutDate',
      'nights',
      'bookingId',
    ],
    statement: [
      'ownerName',
      'periodStart',
      'periodEnd',
      'totalRevenue',
      'totalExpenses',
      'commission',
      'netBalance',
      'currency',
    ],
    issue_notification: [
      'ownerName',
      'propertyName',
      'issueTitle',
      'issueDescription',
      'issueStatus',
      'issuePriority',
      'issueId',
    ],
    payout_notification: [
      'ownerName',
      'amount',
      'currency',
      'payoutDate',
      'payoutId',
    ],
    task_assignment: [
      'ownerName',
      'propertyName',
      'taskTitle',
      'taskDescription',
      'taskDueDate',
      'taskId',
    ],
  }

  return variableMap[type] || []
}

