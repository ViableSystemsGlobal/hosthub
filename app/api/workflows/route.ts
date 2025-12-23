import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

const VALID_TRIGGERS = ['BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_STATUS_CHANGED', 'BOOKING_CHECKOUT', 'TASK_CREATED', 'TASK_COMPLETED', 'TASK_OVERDUE', 'ISSUE_CREATED', 'ISSUE_STATUS_CHANGED', 'ISSUE_PRIORITY_CHANGED', 'EXPENSE_CREATED', 'STATEMENT_FINALIZED', 'SCHEDULED']
const VALID_ACTIONS = ['CREATE_TASK', 'ASSIGN_TASK', 'SEND_NOTIFICATION', 'UPDATE_STATUS', 'UPDATE_PRIORITY', 'CREATE_REMINDER', 'SEND_EMAIL', 'SEND_SMS', 'SEND_WHATSAPP']

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const trigger = searchParams.get('trigger')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (trigger) {
      where.trigger = trigger
    }
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Access workflowRule model (Prisma converts WorkflowRule to workflowRule)
    let workflows
    try {
      workflows = await (prisma as any).workflowRule.findMany({
        where,
        include: {
          CreatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              Executions: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      })
    } catch (modelError: any) {
      // If model doesn't exist, return helpful error
      if (modelError.message?.includes('workflowRule') || 
          modelError.message?.includes('does not exist') ||
          modelError.message?.includes('Unknown arg') ||
          modelError.code === 'P2001') {
        console.error('WorkflowRule model not available:', modelError.message)
        return NextResponse.json(
          { 
            error: 'WorkflowRule model not available. Please restart the server after running: npx prisma generate',
            details: modelError.message 
          },
          { status: 503 }
        )
      }
      throw modelError
    }

    return NextResponse.json(workflows)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workflows', details: error.stack },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can create workflows
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      trigger,
      isActive = true,
      priority = 0,
      conditions,
      actions,
      propertyIds = [],
      ownerIds = [],
      scheduleCron,
    } = body

    // Validate required fields
    if (!name || !trigger || !actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { error: 'Name, trigger, and at least one action are required' },
        { status: 400 }
      )
    }

    // Validate trigger
    if (!VALID_TRIGGERS.includes(trigger)) {
      return NextResponse.json(
        { error: 'Invalid trigger type' },
        { status: 400 }
      )
    }

    // Validate actions
    for (const action of actions) {
      if (!action.type || !VALID_ACTIONS.includes(action.type)) {
        return NextResponse.json(
          { error: 'Invalid action type' },
          { status: 400 }
        )
      }
    }

    // @ts-ignore - WorkflowRule model may not be in types yet
    const workflow = await (prisma as any).workflowRule.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description,
        trigger: trigger,
        isActive,
        priority,
        conditions: conditions || null,
        actions,
        propertyIds,
        ownerIds,
        scheduleCron: scheduleCron || null,
        createdById: user.id,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(workflow, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create workflow:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create workflow' },
      { status: 500 }
    )
  }
}

