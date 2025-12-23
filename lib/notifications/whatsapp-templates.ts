/**
 * WhatsApp Template Configuration
 * Map notification types to Twilio Content SIDs
 * 
 * To get Content SIDs:
 * 1. Go to Twilio Console → Content → Templates
 * 2. Create/approve templates for each notification type
 * 3. Copy the Content SID for each template
 * 4. Update the contentSid values below
 * 
 * Template Variable Mapping:
 * - Twilio uses numbered variables (1, 2, 3...) in Content Variables
 * - Map your variables to these numbers in the order they appear in your template
 */

import { NotificationType } from '@prisma/client'

export interface WhatsAppTemplateConfig {
  contentSid: string
  variables: string[] // Variable names in order (will map to 1, 2, 3...)
}

export const WHATSAPP_TEMPLATES: Partial<Record<NotificationType, WhatsAppTemplateConfig>> = {
  // Example templates - replace Content SIDs with your actual approved templates
  STATEMENT_READY: {
    contentSid: '', // Replace with your Content SID
    variables: ['ownerName', 'month', 'link']
  },
  BOOKING_CREATED: {
    contentSid: '', // Replace with your Content SID
    variables: ['propertyName', 'checkInDate', 'guestName']
  },
  BOOKING_UPDATED: {
    contentSid: '', // Replace with your Content SID
    variables: ['propertyName', 'checkInDate', 'status']
  },
  BOOKING_REMINDER: {
    contentSid: '', // Replace with your Content SID
    variables: ['propertyName', 'checkInDate', 'guestName']
  },
  ISSUE_CREATED: {
    contentSid: '', // Replace with your Content SID
    variables: ['issueTitle', 'propertyName', 'priority']
  },
  ISSUE_ASSIGNED: {
    contentSid: '', // Replace with your Content SID
    variables: ['issueTitle', 'propertyName', 'contactName']
  },
  ISSUE_STATUS_CHANGED: {
    contentSid: '', // Replace with your Content SID
    variables: ['issueTitle', 'propertyName', 'status']
  },
  PAYOUT_MADE: {
    contentSid: '', // Replace with your Content SID
    variables: ['amount', 'currency', 'reference']
  },
}

/**
 * Get WhatsApp template configuration for a notification type
 */
export function getWhatsAppTemplate(
  notificationType: NotificationType,
  variables: Record<string, any>
): { contentSid: string; contentVariables: Record<string, string> } | null {
  const template = WHATSAPP_TEMPLATES[notificationType]
  if (!template || !template.contentSid) {
    return null // No template configured for this type
  }

  // Map variables to Twilio's numbered format (1, 2, 3...)
  const contentVariables: Record<string, string> = {}
  template.variables.forEach((varName, index) => {
    const value = variables[varName] || ''
    // Twilio uses string keys "1", "2", "3" for content variables
    contentVariables[String(index + 1)] = String(value || '')
  })

  return {
    contentSid: template.contentSid,
    contentVariables
  }
}

