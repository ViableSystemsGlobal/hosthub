import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { TaskType, TaskStatus } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        Property: true,
        Booking: true,
        Expense: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch task' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAdmin()
    
    const body = await request.json()
    const {
      type,
      title,
      description,
      assignedToUserId,
      scheduledAt,
      dueAt,
      status,
      costEstimate,
      costActual,
    } = body

    const updateData: any = {
      type: type as TaskType,
      title,
      description,
      assignedToUserId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      costEstimate,
      costActual,
      status: status as TaskStatus,
    }

    // If marking as completed, set completedAt
    if (status === TaskStatus.COMPLETED && !body.completedAt) {
      updateData.completedAt = new Date()
    }

    // Get existing task to check status change
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { Property: true },
    })

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        Property: true,
        Booking: true,
      },
    })

    // Execute workflows if task was completed (non-blocking)
    if (status === TaskStatus.COMPLETED && existingTask?.status !== TaskStatus.COMPLETED) {
      try {
        const { executeWorkflows } = await import('@/lib/workflows/engine')
        
        executeWorkflows('TASK_COMPLETED', {
          entityType: 'task',
          entityId: task.id,
          entityData: task,
          propertyId: task.propertyId,
          ownerId: task.Property.ownerId,
        }).catch((err) => {
          console.error('Failed to execute workflows for task completion:', err)
        })
      } catch (error) {
        console.error('Workflow execution error:', error)
      }
    }

    return NextResponse.json(task)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update task' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAdmin()
    
    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete task' },
      { status: 500 }
    )
  }
}

