import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

interface BackupFile {
  path: string
  name: string
  data: string // Base64 encoded
  mimeType: string
}

/**
 * POST - Restore database and files from backup
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Unauthorized' },
      { status: err.status || 401 }
    )
  }

  try {
    const body = await request.json()
    const { backup, clearExisting = false } = body

    if (!backup || !backup.data) {
      return NextResponse.json(
        { error: 'Invalid backup format' },
        { status: 400 }
      )
    }

    // Validate backup version (support both 1.0 and 1.1)
    if (!['1.0', '1.1'].includes(backup.version)) {
      return NextResponse.json(
        { error: 'Unsupported backup version' },
        { status: 400 }
      )
    }

    // Start transaction with longer timeout for large restores
    await prisma.$transaction(async (tx) => {
      // Clear existing data if requested
      if (clearExisting) {
        // Delete in reverse order of dependencies (children first, then parents)
        // Level 5 - Deepest children
        await tx.inventoryHistory.deleteMany({})
        await tx.electricityAlert.deleteMany({})
        await tx.message.deleteMany({})
        await tx.statementLine.deleteMany({})
        await tx.issueComment.deleteMany({})
        await tx.issueAttachment.deleteMany({})
        await tx.taskAttachment.deleteMany({})
        await tx.taskChecklist.deleteMany({})
        await tx.workflowExecution.deleteMany({})
        
        // Level 4
        await tx.inventoryItem.deleteMany({})
        await tx.electricityMeterReading.deleteMany({})
        await tx.conversation.deleteMany({})
        await tx.statement.deleteMany({})
        await tx.issue.deleteMany({})
        await tx.task.deleteMany({})
        await tx.cleaningChecklist.deleteMany({})
        await tx.workflowRule.deleteMany({})
        
        // Level 3
        await tx.expense.deleteMany({})
        await tx.booking.deleteMany({})
        await tx.document.deleteMany({})
        await tx.ownerTransaction.deleteMany({})
        await tx.payout.deleteMany({})
        await tx.recurringTask.deleteMany({})
        await tx.report.deleteMany({})
        await tx.notification.deleteMany({})
        await tx.aiInsightCache.deleteMany({})
        await tx.contact.deleteMany({})
        await tx.guestContact.deleteMany({})
        
        // Level 2
        await tx.property.deleteMany({})
        await tx.ownerWallet.deleteMany({})
        await tx.emailTemplate.deleteMany({})
        await tx.sMSTemplate.deleteMany({})
        
        // Level 1 - Parents
        await tx.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } })
        await tx.owner.deleteMany({})
      }

      const { data } = backup

      // ========================================
      // RESTORE IN ORDER OF DEPENDENCIES
      // Parents first, then children
      // ========================================

      // Step 1: Owners (no dependencies)
      if (data.owners) {
        for (const owner of data.owners) {
          const { OwnerWallet, User, ...ownerData } = owner
          await tx.owner.upsert({
            where: { id: ownerData.id },
            update: ownerData,
            create: ownerData,
          })
        }
      }

      // Step 2: Users (depends on Owner via ownerId)
      // First restore from users array (non-owner users like managers)
      if (data.users) {
        for (const user of data.users) {
          const userData = { ...user }
          // Check if ownerId exists
          if (userData.ownerId) {
            const ownerExists = await tx.owner.findUnique({
              where: { id: userData.ownerId },
              select: { id: true },
            })
            if (!ownerExists) {
              userData.ownerId = null
            }
          }
          await tx.user.upsert({
            where: { id: userData.id },
            update: userData,
            create: userData,
          })
        }
      }
      // Then restore owner users and wallets
      if (data.owners) {
        for (const owner of data.owners) {
          const { OwnerWallet, User } = owner
          
          if (OwnerWallet) {
            await tx.ownerWallet.upsert({
              where: { id: OwnerWallet.id },
              update: OwnerWallet,
              create: OwnerWallet,
            })
          }

          if (User) {
            await tx.user.upsert({
              where: { id: User.id },
              update: User,
              create: User,
            })
          }
        }
      }

      // Step 3: Properties (depends on Owner, User)
      if (data.properties) {
        for (const property of data.properties) {
          const propertyData = { ...property }
          // Check if managerId exists
          if (propertyData.managerId) {
            const managerExists = await tx.user.findUnique({
              where: { id: propertyData.managerId },
              select: { id: true },
            })
            if (!managerExists) {
              propertyData.managerId = null
            }
          }
          await tx.property.upsert({
            where: { id: propertyData.id },
            update: propertyData,
            create: propertyData,
          })
        }
      }

      // Step 4: Contacts (depends on Owner)
      if (data.contacts) {
        for (const contact of data.contacts) {
          await tx.contact.upsert({
            where: { id: contact.id },
            update: contact,
            create: contact,
          })
        }
      }

      // Step 4.5: GuestContacts (depends on Property, User) - MUST be before Bookings
      if (data.guestContacts) {
        for (const guestContact of data.guestContacts) {
          const gcData = { ...guestContact }
          // Check if propertyId exists
          if (gcData.propertyId) {
            const propertyExists = await tx.property.findUnique({
              where: { id: gcData.propertyId },
              select: { id: true },
            })
            if (!propertyExists) {
              gcData.propertyId = null
            }
          }
          // Check if createdById exists
          if (gcData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: gcData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              gcData.createdById = null
            }
          }
          await tx.guestContact.upsert({
            where: { id: gcData.id },
            update: gcData,
            create: gcData,
          })
        }
      }

      // Step 5: Bookings (depends on Property, Owner, GuestContact)
      if (data.bookings) {
        for (const booking of data.bookings) {
          const bookingData = { ...booking }
          // Check if checkedInById exists
          if (bookingData.checkedInById) {
            const userExists = await tx.user.findUnique({
              where: { id: bookingData.checkedInById },
              select: { id: true },
            })
            if (!userExists) {
              bookingData.checkedInById = null
            }
          }
          // Check if guestContactId exists
          if (bookingData.guestContactId) {
            const guestContactExists = await tx.guestContact.findUnique({
              where: { id: bookingData.guestContactId },
              select: { id: true },
            })
            if (!guestContactExists) {
              bookingData.guestContactId = null
            }
          }
          await tx.booking.upsert({
            where: { id: bookingData.id },
            update: bookingData,
            create: bookingData,
          })
        }
      }

      // Step 6: CleaningChecklists (depends on Property, User) - MUST be before Tasks
      if (data.cleaningChecklists) {
        for (const checklist of data.cleaningChecklists) {
          const checklistData = { ...checklist }
          if (checklistData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: checklistData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              checklistData.createdById = null
            }
          }
          await tx.cleaningChecklist.upsert({
            where: { id: checklistData.id },
            update: checklistData,
            create: checklistData,
          })
        }
      }

      // Step 7: RecurringTasks (depends on Property, Owner, User)
      if (data.recurringTasks) {
        for (const recurringTask of data.recurringTasks) {
          const rtData = { ...recurringTask }
          if (rtData.assignedToUserId) {
            const userExists = await tx.user.findUnique({
              where: { id: rtData.assignedToUserId },
              select: { id: true },
            })
            if (!userExists) {
              rtData.assignedToUserId = null
            }
          }
          if (rtData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: rtData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              rtData.createdById = null
            }
          }
          await tx.recurringTask.upsert({
            where: { id: rtData.id },
            update: rtData,
            create: rtData,
          })
        }
      }

      // Step 8: Tasks (depends on Property, Booking, RecurringTask)
      if (data.tasks) {
        for (const task of data.tasks) {
          const { TaskAttachment, TaskChecklist, ...taskData } = task
          // Check foreign keys
          if (taskData.assignedToUserId) {
            const userExists = await tx.user.findUnique({
              where: { id: taskData.assignedToUserId },
              select: { id: true },
            })
            if (!userExists) {
              taskData.assignedToUserId = null
            }
          }
          if (taskData.recurringTaskId) {
            const rtExists = await tx.recurringTask.findUnique({
              where: { id: taskData.recurringTaskId },
              select: { id: true },
            })
            if (!rtExists) {
              taskData.recurringTaskId = null
            }
          }
          await tx.task.upsert({
            where: { id: taskData.id },
            update: taskData,
            create: taskData,
          })
        }
      }

      // Step 9: TaskAttachments and TaskChecklists (depends on Task, CleaningChecklist)
      if (data.tasks) {
        for (const task of data.tasks) {
          const { TaskAttachment, TaskChecklist } = task

          if (TaskAttachment && TaskAttachment.length > 0) {
            for (const attachment of TaskAttachment) {
              const attachData = { ...attachment }
              if (attachData.uploadedById) {
                const userExists = await tx.user.findUnique({
                  where: { id: attachData.uploadedById },
                  select: { id: true },
                })
                if (!userExists) {
                  attachData.uploadedById = null
                }
              }
              await tx.taskAttachment.upsert({
                where: { id: attachData.id },
                update: attachData,
                create: attachData,
              })
            }
          }

          if (TaskChecklist) {
            // TaskChecklist is a single object, not an array
            const checklist = TaskChecklist
            // Check if the checklistId (CleaningChecklist) exists
            if (checklist.checklistId) {
              const clExists = await tx.cleaningChecklist.findUnique({
                where: { id: checklist.checklistId },
                select: { id: true },
              })
              if (clExists) {
                await tx.taskChecklist.upsert({
                  where: { id: checklist.id },
                  update: checklist,
                  create: checklist,
                })
              }
              // Skip if cleaning checklist doesn't exist
            }
          }
        }
      }

      // Step 10: Expenses (depends on Property, Owner, Task)
      if (data.expenses) {
        for (const expense of data.expenses) {
          const expenseData = { ...expense }
          if (expenseData.linkedTaskId) {
            const taskExists = await tx.task.findUnique({
              where: { id: expenseData.linkedTaskId },
              select: { id: true },
            })
            if (!taskExists) {
              expenseData.linkedTaskId = null
            }
          }
          await tx.expense.upsert({
            where: { id: expenseData.id },
            update: expenseData,
            create: expenseData,
          })
        }
      }

      // Step 11: Statements (depends on Owner)
      if (data.statements) {
        for (const statement of data.statements) {
          const { StatementLine, ...statementData } = statement
          await tx.statement.upsert({
            where: { id: statementData.id },
            update: statementData,
            create: statementData,
          })

          if (StatementLine && StatementLine.length > 0) {
            for (const line of StatementLine) {
              await tx.statementLine.upsert({
                where: { id: line.id },
                update: line,
                create: line,
              })
            }
          }
        }
      }

      // Step 12: Issues (depends on Property, Contact)
      if (data.issues) {
        for (const issue of data.issues) {
          const { IssueAttachment, IssueComment, ...issueData } = issue
          // Check foreign keys
          if (issueData.assignedContactId) {
            const contactExists = await tx.contact.findUnique({
              where: { id: issueData.assignedContactId },
              select: { id: true },
            })
            if (!contactExists) {
              issueData.assignedContactId = null
            }
          }
          if (issueData.assignedToUserId) {
            const userExists = await tx.user.findUnique({
              where: { id: issueData.assignedToUserId },
              select: { id: true },
            })
            if (!userExists) {
              issueData.assignedToUserId = null
            }
          }
          await tx.issue.upsert({
            where: { id: issueData.id },
            update: issueData,
            create: issueData,
          })

          if (IssueAttachment && IssueAttachment.length > 0) {
            for (const attachment of IssueAttachment) {
              await tx.issueAttachment.upsert({
                where: { id: attachment.id },
                update: attachment,
                create: attachment,
              })
            }
          }

          if (IssueComment && IssueComment.length > 0) {
            for (const comment of IssueComment) {
              // Check if user exists
              const userExists = await tx.user.findUnique({
                where: { id: comment.userId },
                select: { id: true },
              })
              if (userExists) {
                await tx.issueComment.upsert({
                  where: { id: comment.id },
                  update: comment,
                  create: comment,
                })
              }
              // Skip comment if user doesn't exist (required field)
            }
          }
        }
      }

      // Step 13: Documents (depends on Property, Owner, Booking, Expense, User)
      if (data.documents) {
        for (const document of data.documents) {
          const docData = { ...document }
          if (docData.uploadedById) {
            const userExists = await tx.user.findUnique({
              where: { id: docData.uploadedById },
              select: { id: true },
            })
            if (!userExists) {
              docData.uploadedById = null
            }
          }
          await tx.document.upsert({
            where: { id: docData.id },
            update: docData,
            create: docData,
          })
        }
      }

      // Step 14: Payouts
      if (data.payouts) {
        for (const payout of data.payouts) {
          await tx.payout.upsert({
            where: { id: payout.id },
            update: payout,
            create: payout,
          })
        }
      }

      // Step 15: Owner Transactions (depends on Owner, Statement)
      if (data.ownerTransactions) {
        for (const transaction of data.ownerTransactions) {
          const txData = { ...transaction }
          if (txData.referenceId) {
            const statementExists = await tx.statement.findUnique({
              where: { id: txData.referenceId },
              select: { id: true },
            })
            if (!statementExists) {
              txData.referenceId = null
            }
          }
          await tx.ownerTransaction.upsert({
            where: { id: txData.id },
            update: txData,
            create: txData,
          })
        }
      }

      // Step 16: Reports
      if (data.reports) {
        for (const report of data.reports) {
          const reportData = { ...report }
          if (reportData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: reportData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              reportData.createdById = null
            }
          }
          await tx.report.upsert({
            where: { id: reportData.id },
            update: reportData,
            create: reportData,
          })
        }
      }

      // Step 17: Electricity Meter Readings (depends on Property, User)
      if (data.electricityMeterReadings) {
        for (const reading of data.electricityMeterReadings) {
          const readingData = { ...reading }
          if (readingData.enteredById) {
            const userExists = await tx.user.findUnique({
              where: { id: readingData.enteredById },
              select: { id: true },
            })
            if (!userExists) {
              readingData.enteredById = null
            }
          }
          await tx.electricityMeterReading.upsert({
            where: { id: readingData.id },
            update: readingData,
            create: readingData,
          })
        }
      }

      // Step 18: Electricity Alerts (depends on Property, ElectricityMeterReading)
      if (data.electricityAlerts) {
        for (const alert of data.electricityAlerts) {
          // Check if the reading exists
          const readingExists = await tx.electricityMeterReading.findUnique({
            where: { id: alert.readingId },
            select: { id: true },
          })
          if (readingExists) {
            await tx.electricityAlert.upsert({
              where: { id: alert.id },
              update: alert,
              create: alert,
            })
          }
        }
      }

      // Step 19: Inventory Items (depends on Property, User)
      if (data.inventoryItems) {
        for (const item of data.inventoryItems) {
          const { History, ...itemData } = item
          if (itemData.lastCheckedById) {
            const userExists = await tx.user.findUnique({
              where: { id: itemData.lastCheckedById },
              select: { id: true },
            })
            if (!userExists) {
              itemData.lastCheckedById = null
            }
          }
          await tx.inventoryItem.upsert({
            where: { id: itemData.id },
            update: itemData,
            create: itemData,
          })

          if (History && History.length > 0) {
            for (const history of History) {
              const histData = { ...history }
              if (histData.changedById) {
                const userExists = await tx.user.findUnique({
                  where: { id: histData.changedById },
                  select: { id: true },
                })
                if (!userExists) {
                  histData.changedById = null
                }
              }
              await tx.inventoryHistory.upsert({
                where: { id: histData.id },
                update: histData,
                create: histData,
              })
            }
          }
        }
      }

      // Step 20: Workflows (depends on User)
      if (data.workflows) {
        for (const workflow of data.workflows) {
          const wfData = { ...workflow }
          if (wfData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: wfData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              wfData.createdById = null
            }
          }
          await tx.workflowRule.upsert({
            where: { id: wfData.id },
            update: wfData,
            create: wfData,
          })
        }
      }

      // Step 21: Workflow Executions (depends on WorkflowRule)
      if (data.workflowExecutions) {
        for (const execution of data.workflowExecutions) {
          // Check if workflow exists
          const wfExists = await tx.workflowRule.findUnique({
            where: { id: execution.workflowRuleId },
            select: { id: true },
          })
          if (wfExists) {
            await tx.workflowExecution.upsert({
              where: { id: execution.id },
              update: execution,
              create: execution,
            })
          }
        }
      }

      // Step 22: Conversations (depends on Owner)
      if (data.conversations) {
        for (const conversation of data.conversations) {
          const { Message, ...conversationData } = conversation
          await tx.conversation.upsert({
            where: { id: conversationData.id },
            update: conversationData,
            create: conversationData,
          })

          if (Message && Message.length > 0) {
            for (const message of Message) {
              await tx.message.upsert({
                where: { id: message.id },
                update: message,
                create: message,
              })
            }
          }
        }
      }

      // Step 23: Notifications (depends on Owner)
      if (data.notifications) {
        for (const notification of data.notifications) {
          await tx.notification.upsert({
            where: { id: notification.id },
            update: notification,
            create: notification,
          })
        }
      }

      // Step 24: AI Insight Cache
      if (data.aiInsightCache) {
        for (const cache of data.aiInsightCache) {
          await tx.aiInsightCache.upsert({
            where: { id: cache.id },
            update: cache,
            create: cache,
          })
        }
      }

      // Step 25: Email Templates (depends on User)
      if (data.emailTemplates) {
        for (const template of data.emailTemplates) {
          const tplData = { ...template }
          if (tplData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: tplData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              tplData.createdById = null
            }
          }
          await tx.emailTemplate.upsert({
            where: { id: tplData.id },
            update: tplData,
            create: tplData,
          })
        }
      }

      // Step 26: SMS Templates (depends on User)
      if (data.smsTemplates) {
        for (const template of data.smsTemplates) {
          const tplData = { ...template }
          if (tplData.createdById) {
            const userExists = await tx.user.findUnique({
              where: { id: tplData.createdById },
              select: { id: true },
            })
            if (!userExists) {
              tplData.createdById = null
            }
          }
          await tx.sMSTemplate.upsert({
            where: { id: tplData.id },
            update: tplData,
            create: tplData,
          })
        }
      }

      // Step 27: Settings (no dependencies)
      if (data.settings) {
        for (const setting of data.settings) {
          await tx.setting.upsert({
            where: { key: setting.key },
            update: setting,
            create: setting,
          })
        }
      }
    }, {
      timeout: 120000, // 2 minute timeout for large restores
    })

    // Restore files (outside transaction since it's filesystem operations)
    let filesRestored = 0
    let filesSkipped = 0
    
    if (backup.files && Array.isArray(backup.files)) {
      const publicDir = join(process.cwd(), 'public')
      
      for (const file of backup.files as BackupFile[]) {
        try {
          // Construct full path
          const fullPath = join(publicDir, file.path)
          
          // Create directory if it doesn't exist
          const dirPath = dirname(fullPath)
          await mkdir(dirPath, { recursive: true })
          
          // Decode base64 and write file
          const buffer = Buffer.from(file.data, 'base64')
          await writeFile(fullPath, buffer)
          
          filesRestored++
        } catch (fileError) {
          console.error(`Failed to restore file ${file.path}:`, fileError)
          filesSkipped++
          // Continue with other files
        }
      }
      
      console.log(`Files restored: ${filesRestored}, skipped: ${filesSkipped}`)
    }

    return NextResponse.json({
      success: true,
      message: `Backup restored successfully. ${filesRestored > 0 ? `${filesRestored} files restored.` : ''} ${filesSkipped > 0 ? `${filesSkipped} files skipped.` : ''}`.trim(),
      filesRestored,
      filesSkipped,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Restore error:', error)
    return NextResponse.json(
      { error: err.message || 'Failed to restore backup' },
      { status: 500 }
    )
  }
}
