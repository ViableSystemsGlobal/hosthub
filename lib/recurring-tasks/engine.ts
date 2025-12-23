/**
 * Recurring Tasks Engine
 * Generates tasks from recurring task templates
 */

import { prisma } from '@/lib/prisma'
import { TaskType, TaskStatus } from '@prisma/client'

type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
type RecurrenceDayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

interface RecurringTask {
  id: string
  propertyId: string | null
  ownerId: string | null
  type: TaskType
  title: string
  description: string | null
  assignedToUserId: string | null
  frequency: RecurrenceFrequency
  interval: number
  dayOfWeek: RecurrenceDayOfWeek | null
  dayOfMonth: number | null
  startDate: Date
  endDate: Date | null
  nextRunDate: Date
  isActive: boolean
  costEstimate: number | null
}

/**
 * Calculate the next run date based on frequency and interval
 */
function calculateNextRunDate(
  frequency: RecurrenceFrequency,
  interval: number,
  lastRunDate: Date,
  dayOfWeek?: RecurrenceDayOfWeek | null,
  dayOfMonth?: number | null
): Date {
  const next = new Date(lastRunDate)

  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + interval)
      break

    case 'WEEKLY':
      if (dayOfWeek) {
        // Find next occurrence of the specified day
        const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
        const targetDay = daysOfWeek.indexOf(dayOfWeek)
        const currentDay = next.getDay()
        
        let daysToAdd = (targetDay - currentDay + 7) % 7
        if (daysToAdd === 0) daysToAdd = 7 // If today is the day, schedule for next week
        next.setDate(next.getDate() + daysToAdd)
      } else {
        next.setDate(next.getDate() + (7 * interval))
      }
      break

    case 'MONTHLY':
      if (dayOfMonth) {
        // Set to the specified day of next month
        next.setMonth(next.getMonth() + interval)
        // Handle day of month (e.g., 31st might not exist in next month)
        const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, daysInMonth))
      } else {
        // Use the same day of month
        next.setMonth(next.getMonth() + interval)
      }
      break

    case 'QUARTERLY':
      next.setMonth(next.getMonth() + (3 * interval))
      if (dayOfMonth) {
        const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, daysInMonth))
      }
      break

    case 'YEARLY':
      next.setFullYear(next.getFullYear() + interval)
      if (dayOfMonth) {
        const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, daysInMonth))
      }
      break
  }

  return next
}

/**
 * Check if a recurring task should generate a task today
 */
function shouldGenerateToday(recurringTask: RecurringTask, today: Date = new Date()): boolean {
  if (!recurringTask.isActive) return false

  // Check if past end date
  if (recurringTask.endDate && today > recurringTask.endDate) return false

  // Check if before start date
  if (today < recurringTask.startDate) return false

  // Check if next run date is today or in the past
  const nextRun = new Date(recurringTask.nextRunDate)
  nextRun.setHours(0, 0, 0, 0)
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  return nextRun <= todayStart
}

/**
 * Generate tasks from recurring tasks that are due
 */
export async function generateRecurringTasks(): Promise<{
  generated: number
  errors: string[]
}> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let generated = 0
  const errors: string[] = []

  try {
    // Check if RecurringTask model exists
    if (!(prisma as any).recurringTask) {
      return {
        generated: 0,
        errors: ['RecurringTask model not available. Please restart the server after running: npx prisma generate'],
      }
    }

    // Find all active recurring tasks that should run today
    const recurringTasks = await (prisma as any).recurringTask.findMany({
      where: {
        isActive: true,
        nextRunDate: {
          lte: today,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: today } },
        ],
      },
      include: {
        Property: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    })

    for (const recurringTask of recurringTasks) {
      try {
        // Double-check if we should generate (in case of edge cases)
        if (!shouldGenerateToday(recurringTask, today)) {
          continue
        }

        // Determine property and owner
        const propertyId = recurringTask.propertyId || recurringTask.Property?.id
        const ownerId = recurringTask.ownerId || recurringTask.Property?.ownerId

        if (!propertyId) {
          errors.push(`Recurring task "${recurringTask.title}" has no property assigned`)
          continue
        }

        // Calculate due date (default to same day, or can be configured)
        const dueDate = new Date(today)
        dueDate.setHours(23, 59, 59, 999) // End of day

        // Create the task
        const task = await prisma.task.create({
          data: {
            id: crypto.randomUUID(),
            propertyId,
            recurringTaskId: recurringTask.id,
            type: recurringTask.type,
            title: recurringTask.title,
            description: recurringTask.description || null,
            assignedToUserId: recurringTask.assignedToUserId || null,
            scheduledAt: new Date(today),
            dueAt: dueDate,
            status: TaskStatus.PENDING,
            costEstimate: recurringTask.costEstimate || null,
            updatedAt: new Date(),
          },
        })

        // Calculate next run date
        const nextRunDate = calculateNextRunDate(
          recurringTask.frequency,
          recurringTask.interval,
          today,
          recurringTask.dayOfWeek,
          recurringTask.dayOfMonth
        )

        // Update recurring task
        await (prisma as any).recurringTask.update({
          where: { id: recurringTask.id },
          data: {
            nextRunDate,
            lastGeneratedAt: new Date(),
            totalGenerated: { increment: 1 },
            updatedAt: new Date(),
          },
        })

        generated++
      } catch (error: any) {
        errors.push(`Failed to generate task from "${recurringTask.title}": ${error.message}`)
        console.error(`Error generating task from recurring task ${recurringTask.id}:`, error)
      }
    }

    return { generated, errors }
  } catch (error: any) {
    console.error('Error in generateRecurringTasks:', error)
    return {
      generated: 0,
      errors: [`Failed to process recurring tasks: ${error.message}`],
    }
  }
}

/**
 * Get all recurring tasks for a property or owner
 */
export async function getRecurringTasks(
  propertyId?: string,
  ownerId?: string
): Promise<RecurringTask[]> {
  const where: any = { isActive: true }

  if (propertyId) {
    where.propertyId = propertyId
  } else if (ownerId) {
    where.ownerId = ownerId
  }

  // Check if RecurringTask model exists
  if (!(prisma as any).recurringTask) {
    return []
  }

  return await (prisma as any).recurringTask.findMany({
    where,
    orderBy: { nextRunDate: 'asc' },
  })
}

