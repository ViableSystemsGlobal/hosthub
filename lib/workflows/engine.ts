/**
 * Workflow Engine
 * Executes workflow rules based on triggers
 */

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications/service'
import { NotificationChannel, NotificationType, TaskType, TaskStatus } from '@prisma/client'

// Import enums from Prisma client
type WorkflowTrigger = 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_STATUS_CHANGED' | 'BOOKING_CHECKOUT' | 'BOOKING_CHECKED_IN' | 'TASK_CREATED' | 'TASK_COMPLETED' | 'TASK_OVERDUE' | 'ISSUE_CREATED' | 'ISSUE_STATUS_CHANGED' | 'ISSUE_PRIORITY_CHANGED' | 'EXPENSE_CREATED' | 'STATEMENT_FINALIZED' | 'SCHEDULED'
type WorkflowAction = 'CREATE_TASK' | 'ASSIGN_TASK' | 'SEND_NOTIFICATION' | 'UPDATE_STATUS' | 'UPDATE_PRIORITY' | 'CREATE_REMINDER' | 'SEND_EMAIL' | 'SEND_SMS' | 'SEND_WHATSAPP'
type WorkflowConditionOperator = 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS' | 'IN' | 'NOT_IN'

interface WorkflowCondition {
  field: string
  operator: WorkflowConditionOperator
  value: any
}

interface WorkflowActionConfig {
  type: WorkflowAction
  params: Record<string, any>
}

interface TriggerContext {
  entityType: 'booking' | 'task' | 'issue' | 'expense' | 'statement'
  entityId: string
  entityData: any
  propertyId?: string
  ownerId?: string
}

/**
 * Evaluate a condition against entity data
 */
function evaluateCondition(
  condition: WorkflowCondition,
  entityData: any
): boolean {
  const { field, operator, value } = condition
  const fieldValue = getNestedValue(entityData, field)

  switch (operator) {
    case 'EQUALS':
      return fieldValue === value
    case 'NOT_EQUALS':
      return fieldValue !== value
    case 'GREATER_THAN':
      return Number(fieldValue) > Number(value)
    case 'LESS_THAN':
      return Number(fieldValue) < Number(value)
    case 'CONTAINS':
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase())
    case 'IN':
      return Array.isArray(value) && value.includes(fieldValue)
    case 'NOT_IN':
      return Array.isArray(value) && !value.includes(fieldValue)
    default:
      return false
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj)
}

/**
 * Check if workflow rule conditions are met
 */
function checkConditions(
  conditions: WorkflowCondition[] | null,
  entityData: any
): boolean {
  if (!conditions || conditions.length === 0) {
    return true // No conditions = always true
  }

  // All conditions must be true (AND logic)
  return conditions.every((condition) => evaluateCondition(condition, entityData))
}

/**
 * Check if workflow applies to this entity (property/owner scope)
 */
async function checkScope(
  workflow: any,
  propertyId?: string,
  ownerId?: string
): Promise<boolean> {
  // If no scope filters, applies to all
  if (
    (!workflow.propertyIds || workflow.propertyIds.length === 0) &&
    (!workflow.ownerIds || workflow.ownerIds.length === 0)
  ) {
    return true
  }

  // Check property scope
  if (workflow.propertyIds && workflow.propertyIds.length > 0) {
    if (!propertyId || !workflow.propertyIds.includes(propertyId)) {
      return false
    }
  }

  // Check owner scope
  if (workflow.ownerIds && workflow.ownerIds.length > 0) {
    if (!ownerId || !workflow.ownerIds.includes(ownerId)) {
      return false
    }
  }

  return true
}

/**
 * Execute a workflow action
 */
async function executeAction(
  action: WorkflowActionConfig,
  context: TriggerContext
): Promise<{ success: boolean; error?: string }> {
  const { type, params } = action
  const { entityData, propertyId, ownerId } = context

  try {
    switch (type) {
      case 'CREATE_TASK': {
        if (!propertyId) {
          return { success: false, error: 'Property ID required for task creation' }
        }

        const task = await prisma.task.create({
          data: {
            id: crypto.randomUUID(),
            propertyId,
            bookingId: context.entityType === 'booking' ? context.entityId : null,
            type: (params.type as TaskType) || TaskType.OTHER,
            title: params.title || 'Auto-generated task',
            description: params.description || '',
            scheduledAt: params.scheduledAt ? new Date(params.scheduledAt) : null,
            dueAt: params.dueAt ? new Date(params.dueAt) : new Date(),
            status: TaskStatus.PENDING,
            assignedToUserId: params.assignedToUserId || null,
            costEstimate: params.costEstimate || null,
            updatedAt: new Date(),
          },
        })

        return { success: true }
      }

      case 'ASSIGN_TASK': {
        if (!params.taskId || !params.userId) {
          return { success: false, error: 'Task ID and User ID required' }
        }

        await prisma.task.update({
          where: { id: params.taskId },
          data: {
            assignedToUserId: params.userId,
            updatedAt: new Date(),
          },
        })

        return { success: true }
      }

      case 'SEND_NOTIFICATION': {
        if (!ownerId) {
          return { success: false, error: 'Owner ID required for notifications' }
        }

        const channels: NotificationChannel[] = params.channels || [NotificationChannel.EMAIL]
        const notificationType = (params.notificationType as NotificationType) || NotificationType.OTHER

        await sendNotification({
          ownerId,
          type: notificationType,
          channels,
          title: params.title || 'Notification',
          message: params.message || '',
          actionUrl: params.actionUrl,
          actionText: params.actionText,
          templateType: params.templateType,
          templateVariables: params.templateVariables || {},
        })

        return { success: true }
      }

      case 'UPDATE_STATUS': {
        if (!params.status) {
          return { success: false, error: 'Status required' }
        }

        const model = context.entityType === 'booking' ? prisma.booking :
                     context.entityType === 'task' ? prisma.task :
                     context.entityType === 'issue' ? prisma.issue : null

        if (!model) {
          return { success: false, error: `Cannot update status for ${context.entityType}` }
        }

        await (model as any).update({
          where: { id: context.entityId },
          data: { status: params.status, updatedAt: new Date() },
        })

        return { success: true }
      }

      case 'UPDATE_PRIORITY': {
        if (context.entityType !== 'issue' || !params.priority) {
          return { success: false, error: 'Priority update only supported for issues' }
        }

        await prisma.issue.update({
          where: { id: context.entityId },
          data: { priority: params.priority, updatedAt: new Date() },
        })

        return { success: true }
      }

      case 'SEND_EMAIL':
      case 'SEND_SMS':
      case 'SEND_WHATSAPP': {
        if (!ownerId) {
          return { success: false, error: 'Owner ID required' }
        }

        const channel = type === 'SEND_EMAIL' ? NotificationChannel.EMAIL :
                       type === 'SEND_SMS' ? NotificationChannel.SMS :
                       NotificationChannel.WHATSAPP

        await sendNotification({
          ownerId,
          type: NotificationType.OTHER,
          channels: [channel],
          title: params.subject || params.title || 'Message',
          message: params.message || '',
          actionUrl: params.actionUrl,
          actionText: params.actionText,
        })

        return { success: true }
      }

      default:
        return { success: false, error: `Unknown action type: ${type}` }
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Action execution failed' }
  }
}

/**
 * Execute workflow rules for a trigger
 */
export async function executeWorkflows(
  trigger: WorkflowTrigger,
  context: TriggerContext
): Promise<{ executed: number; failed: number; errors: string[] }> {
  const { entityType, entityId, entityData, propertyId, ownerId } = context

  // Find active workflows for this trigger, ordered by priority
  // @ts-ignore - WorkflowRule model may not be in types yet
  const workflows = await (prisma as any).workflowRule.findMany({
    where: {
      trigger,
      isActive: true,
    },
    orderBy: {
      priority: 'desc',
    },
  })

  let executed = 0
  let failed = 0
  const errors: string[] = []

  for (const workflow of workflows) {
    try {
      // Check scope
      const inScope = await checkScope(workflow, propertyId, ownerId)
      if (!inScope) {
        continue
      }

      // Check conditions
      const conditions = workflow.conditions as WorkflowCondition[] | null
      const conditionsMet = checkConditions(conditions, entityData)
      if (!conditionsMet) {
        continue
      }

      // Execute actions
      const actions = workflow.actions as WorkflowActionConfig[]
      const actionResults = await Promise.allSettled(
        actions.map((action) => executeAction(action, context))
      )

      const actionErrors: string[] = []
      let allSuccess = true

      for (const result of actionResults) {
        if (result.status === 'fulfilled') {
          if (!result.value.success) {
            allSuccess = false
            actionErrors.push(result.value.error || 'Unknown error')
          }
        } else {
          allSuccess = false
          actionErrors.push(result.reason?.message || 'Action failed')
        }
      }

      // Log execution
      // @ts-ignore - WorkflowExecution model may not be in types yet
      await (prisma as any).workflowExecution.create({
        data: {
          id: crypto.randomUUID(),
          workflowRuleId: workflow.id,
          triggerType: trigger,
          triggerEntityId: entityId,
          status: allSuccess ? 'SUCCESS' : actionErrors.length === actions.length ? 'FAILED' : 'PARTIAL',
          errorMessage: actionErrors.length > 0 ? actionErrors.join('; ') : null,
          executionLog: {
          actions: actions.map((a: any, i: number) => ({
            type: a.type,
            params: a.params,
            result: actionResults[i].status === 'fulfilled' ? actionResults[i].value : { error: actionResults[i].reason },
          })),
          },
        },
      })

      // Update workflow stats
      // @ts-ignore - WorkflowRule model may not be in types yet
      await (prisma as any).workflowRule.update({
        where: { id: workflow.id },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      })

      if (allSuccess) {
        executed++
      } else {
        failed++
        errors.push(`Workflow "${workflow.name}": ${actionErrors.join(', ')}`)
      }
    } catch (error: any) {
      failed++
      errors.push(`Workflow "${workflow.name}": ${error.message || 'Execution failed'}`)
    }
  }

  return { executed, failed, errors }
}

