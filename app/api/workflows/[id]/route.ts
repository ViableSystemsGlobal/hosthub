import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

const VALID_TRIGGERS = ['BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_STATUS_CHANGED', 'BOOKING_CHECKOUT', 'TASK_CREATED', 'TASK_COMPLETED', 'TASK_OVERDUE', 'ISSUE_CREATED', 'ISSUE_STATUS_CHANGED', 'ISSUE_PRIORITY_CHANGED', 'EXPENSE_CREATED', 'STATEMENT_FINALIZED', 'SCHEDULED']
const VALID_ACTIONS = ['CREATE_TASK', 'ASSIGN_TASK', 'SEND_NOTIFICATION', 'UPDATE_STATUS', 'UPDATE_PRIORITY', 'CREATE_REMINDER', 'SEND_EMAIL', 'SEND_SMS', 'SEND_WHATSAPP']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params

    // @ts-ignore - WorkflowRule model may not be in types yet
    const workflow = await (prisma as any).workflowRule.findUnique({
      where: { id },
      include: {
        CreatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Executions: {
          take: 10,
          orderBy: { executedAt: 'desc' },
        },
      },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch workflow:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      name,
      description,
      trigger,
      isActive,
      priority,
      conditions,
      actions,
      propertyIds,
      ownerIds,
      scheduleCron,
    } = body

    // Validate if provided
    if (trigger && !VALID_TRIGGERS.includes(trigger)) {
      return NextResponse.json(
        { error: 'Invalid trigger type' },
        { status: 400 }
      )
    }

    if (actions && Array.isArray(actions)) {
      for (const action of actions) {
        if (!action.type || !VALID_ACTIONS.includes(action.type)) {
          return NextResponse.json(
            { error: 'Invalid action type' },
            { status: 400 }
          )
        }
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (trigger !== undefined) updateData.trigger = trigger
    if (isActive !== undefined) updateData.isActive = isActive
    if (priority !== undefined) updateData.priority = priority
    if (conditions !== undefined) updateData.conditions = conditions
    if (actions !== undefined) updateData.actions = actions
    if (propertyIds !== undefined) updateData.propertyIds = propertyIds
    if (ownerIds !== undefined) updateData.ownerIds = ownerIds
    if (scheduleCron !== undefined) updateData.scheduleCron = scheduleCron

    // @ts-ignore - WorkflowRule model may not be in types yet
    const workflow = await (prisma as any).workflowRule.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(workflow)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }
    console.error('Failed to update workflow:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update workflow' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params

    // @ts-ignore - WorkflowRule model may not be in types yet
    await (prisma as any).workflowRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }
    console.error('Failed to delete workflow:', error)
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    )
  }
}

