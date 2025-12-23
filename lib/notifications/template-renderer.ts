/**
 * Email Template Renderer
 * Renders email templates with variable substitution
 */

import { prisma } from '@/lib/prisma'

interface TemplateVariables {
  [key: string]: string | number | null | undefined
}

/**
 * Render an email template with variables
 */
export async function renderEmailTemplate(
  templateId: string,
  variables: TemplateVariables
): Promise<{ subject: string; body: string } | null> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template || !template.isActive) {
      return null
    }

    return {
      subject: replaceVariables(template.subject, variables),
      body: replaceVariables(template.body, variables),
    }
  } catch (error) {
    console.error('Failed to render email template:', error)
    return null
  }
}

/**
 * Render an email template by type (uses default template for that type)
 */
export async function renderEmailTemplateByType(
  type: string,
  variables: TemplateVariables
): Promise<{ subject: string; body: string } | null> {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: {
        type,
        isDefault: true,
        isActive: true,
      },
    })

    if (!template) {
      return null
    }

    return {
      subject: replaceVariables(template.subject, variables),
      body: replaceVariables(template.body, variables),
    }
  } catch (error) {
    console.error('Failed to render email template by type:', error)
    return null
  }
}

/**
 * Replace variables in a template string
 * Supports {{variableName}} syntax
 */
function replaceVariables(template: string, variables: TemplateVariables): string {
  let result = template

  // Replace all {{variableName}} patterns
  Object.keys(variables).forEach((key) => {
    const value = variables[key]
    const stringValue = value !== null && value !== undefined ? String(value) : ''
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, stringValue)
  })

  // Remove any remaining unreplaced variables (optional - you might want to keep them)
  // result = result.replace(/{{[^}]+}}/g, '')

  return result
}

/**
 * Get available variables for a template type
 */
export async function getTemplateVariables(type: string): Promise<string[]> {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: {
        type,
        isDefault: true,
        isActive: true,
      },
    })

    if (!template || !template.variables) {
      return []
    }

    return Array.isArray(template.variables) ? template.variables : []
  } catch (error) {
    console.error('Failed to get template variables:', error)
    return []
  }
}

