import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { TaskStatus, UserRole } from '@prisma/client'
import { sendSMS } from '@/lib/notifications/sms'
import { sendEmail, generateEmailTemplate } from '@/lib/notifications/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only operations, managers, and admins can mark tasks as ready
    if (!['OPERATIONS', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        TaskChecklist: true,
        Property: {
          include: {
            Owner: {
              include: {
                User: true,
              },
            },
            User: true, // Manager (User relation)
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && task.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only mark tasks ready for properties you manage' },
        { status: 403 }
      )
    }

    // Verify checklist is completed
    if (task.TaskChecklist) {
      const items = task.TaskChecklist.items as any[]
      const allCompleted = items.every((item: any) => item.completed === true)
      
      if (!allCompleted) {
        return NextResponse.json(
          { error: 'All checklist items must be completed before marking as ready' },
          { status: 400 }
        )
      }
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        isReadyForGuest: true,
        status: TaskStatus.COMPLETED,
        completedAt: task.completedAt || new Date(),
        updatedAt: new Date(),
      },
      include: {
        Property: true,
        Booking: true,
        TaskChecklist: true,
        TaskAttachment: true,
      },
    })

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      const property = await prisma.property.findUnique({
        where: { id: task.propertyId },
        select: { ownerId: true },
      })
      
      executeWorkflows('TASK_COMPLETED', {
        entityType: 'task',
        entityId: task.id,
        entityData: updatedTask,
        propertyId: task.propertyId,
        ownerId: property?.ownerId,
      }).catch((err) => {
        console.error('Failed to execute workflows for task completion:', err)
      })
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    // Send SMS and Email notifications to owner, manager, and admins (non-blocking)
    try {
      const propertyName = task.Property.nickname || task.Property.name
      const taskTitle = task.title
      const smsMessage = `✅ Cleaning Complete: ${propertyName} has been cleaned and is ready for guests. Task: ${taskTitle}`
      const emailSubject = `Cleaning Complete: ${propertyName} is Ready for Guests`
      const emailMessage = `The property "${propertyName}" has been cleaned and is ready for guests.\n\nTask: ${taskTitle}\n\nThis property is now ready for guest check-in.`

      // Collect recipients with both phone and email
      const recipients: Array<{
        phoneNumber?: string
        email?: string
        name: string
      }> = []

      // Add property owner
      if (task.Property.Owner) {
        const ownerPhone = task.Property.Owner.phoneNumber || task.Property.Owner.whatsappNumber
        const ownerEmail = task.Property.Owner.User?.email || task.Property.Owner.email
        if (ownerPhone || ownerEmail) {
          recipients.push({
            phoneNumber: ownerPhone || undefined,
            email: ownerEmail || undefined,
            name: task.Property.Owner.name || 'Property Owner',
          })
        }
      }

      // Add property manager
      if (task.Property.User) {
        const managerPhone = task.Property.User.phoneNumber
        const managerEmail = task.Property.User.email
        if (managerPhone || managerEmail) {
          recipients.push({
            phoneNumber: managerPhone || undefined,
            email: managerEmail || undefined,
            name: task.Property.User.name || task.Property.User.email || 'Property Manager',
          })
        }
      }

      // Add all admins and super admins
      const admins = await prisma.user.findMany({
        where: {
          role: {
            in: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
          },
        },
        select: {
          phoneNumber: true,
          name: true,
          email: true,
        },
      })

      admins.forEach((admin) => {
        if (admin.phoneNumber || admin.email) {
          recipients.push({
            phoneNumber: admin.phoneNumber || undefined,
            email: admin.email || undefined,
            name: admin.name || admin.email || 'Admin',
          })
        }
      })

      console.log(`Sending cleaning ready notifications to ${recipients.length} recipients`)

      // Send SMS and Email to all recipients (non-blocking)
      const notificationPromises = recipients.flatMap((recipient) => {
        const promises: Promise<any>[] = []

        // Send SMS if phone number available
        if (recipient.phoneNumber) {
          promises.push(
            sendSMS(recipient.phoneNumber, smsMessage)
              .then((result) => {
                if (result.success) {
                  console.log(`✅ SMS sent to ${recipient.name} (${recipient.phoneNumber})`)
                } else {
                  console.error(`❌ SMS failed for ${recipient.name}: ${result.error}`)
                }
                return result
              })
              .catch((err) => {
                console.error(`❌ SMS error for ${recipient.name} (${recipient.phoneNumber}):`, err)
                return { success: false, error: err.message }
              })
          )
        }

        // Send Email if email available
        if (recipient.email) {
          promises.push(
            sendEmail({
              to: recipient.email,
              subject: emailSubject,
              html: await generateEmailTemplate(emailSubject, emailMessage.replace(/\n/g, '<br>')),
            })
              .then((result) => {
                if (result.success) {
                  console.log(`✅ Email sent to ${recipient.name} (${recipient.email})`)
                } else {
                  console.error(`❌ Email failed for ${recipient.name}: ${result.error}`)
                }
                return result
              })
              .catch((err) => {
                console.error(`❌ Email error for ${recipient.name} (${recipient.email}):`, err)
                return { success: false, error: err.message }
              })
          )
        }

        return promises
      })

      const results = await Promise.allSettled(notificationPromises)
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length
      console.log(`📧 Sent ${successCount}/${notificationPromises.length} notifications successfully`)
    } catch (error) {
      console.error('❌ Failed to send cleaning ready notifications:', error)
      // Don't fail the request if notifications fail
    }

    return NextResponse.json(updatedTask)
  } catch (error: any) {
    console.error('Failed to mark task as ready:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark task as ready' },
      { status: 500 }
    )
  }
}

