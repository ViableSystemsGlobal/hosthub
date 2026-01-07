import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * POST - Restore database from backup
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.status || 401 }
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

    // Validate backup version
    if (backup.version !== '1.0') {
      return NextResponse.json(
        { error: 'Unsupported backup version' },
        { status: 400 }
      )
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Clear existing data if requested
      if (clearExisting) {
        // Delete in reverse order of dependencies
        await tx.inventoryHistory.deleteMany({})
        await tx.inventoryItem.deleteMany({})
        await tx.electricityAlert.deleteMany({})
        await tx.electricityMeterReading.deleteMany({})
        await tx.cleaningChecklist.deleteMany({})
        await tx.report.deleteMany({})
        await tx.recurringTask.deleteMany({})
        await tx.workflowExecution.deleteMany({})
        await tx.workflowRule.deleteMany({})
        await tx.message.deleteMany({})
        await tx.conversation.deleteMany({})
        await tx.aiInsightCache.deleteMany({})
        await tx.notification.deleteMany({})
        await tx.taskChecklist.deleteMany({})
        await tx.taskAttachment.deleteMany({})
        await tx.task.deleteMany({})
        await tx.issueComment.deleteMany({})
        await tx.issueAttachment.deleteMany({})
        await tx.issue.deleteMany({})
        await tx.statementLine.deleteMany({})
        await tx.statement.deleteMany({})
        await tx.expense.deleteMany({})
        await tx.booking.deleteMany({})
        await tx.document.deleteMany({})
        await tx.ownerTransaction.deleteMany({})
        await tx.payout.deleteMany({})
        await tx.contact.deleteMany({})
        await tx.property.deleteMany({})
        await tx.ownerWallet.deleteMany({})
        await tx.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } })
        await tx.owner.deleteMany({})
      }

      const { data } = backup

      // Restore in order of dependencies
      // 1. Owners (with wallets and users)
      if (data.owners) {
        for (const owner of data.owners) {
          const { OwnerWallet, User, ...ownerData } = owner
          await tx.owner.upsert({
            where: { id: ownerData.id },
            update: ownerData,
            create: ownerData,
          })

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

      // 2. Properties
      if (data.properties) {
        for (const property of data.properties) {
          await tx.property.upsert({
            where: { id: property.id },
            update: property,
            create: property,
          })
        }
      }

      // 3. Bookings
      if (data.bookings) {
        for (const booking of data.bookings) {
          await tx.booking.upsert({
            where: { id: booking.id },
            update: booking,
            create: booking,
          })
        }
      }

      // 4. Expenses
      if (data.expenses) {
        for (const expense of data.expenses) {
          await tx.expense.upsert({
            where: { id: expense.id },
            update: expense,
            create: expense,
          })
        }
      }

      // 5. Statements
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

      // 6. Issues
      if (data.issues) {
        for (const issue of data.issues) {
          const { IssueAttachment, IssueComment, ...issueData } = issue
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
              await tx.issueComment.upsert({
                where: { id: comment.id },
                update: comment,
                create: comment,
              })
            }
          }
        }
      }

      // 7. Tasks
      if (data.tasks) {
        for (const task of data.tasks) {
          const { TaskAttachment, TaskChecklist, ...taskData } = task
          await tx.task.upsert({
            where: { id: taskData.id },
            update: taskData,
            create: taskData,
          })

          if (TaskAttachment && TaskAttachment.length > 0) {
            for (const attachment of TaskAttachment) {
              await tx.taskAttachment.upsert({
                where: { id: attachment.id },
                update: attachment,
                create: attachment,
              })
            }
          }

          if (TaskChecklist && TaskChecklist.length > 0) {
            for (const checklist of TaskChecklist) {
              await tx.taskChecklist.upsert({
                where: { id: checklist.id },
                update: checklist,
                create: checklist,
              })
            }
          }
        }
      }

      // 8. Documents
      if (data.documents) {
        for (const document of data.documents) {
          await tx.document.upsert({
            where: { id: document.id },
            update: document,
            create: document,
          })
        }
      }

      // 9. Contacts
      if (data.contacts) {
        for (const contact of data.contacts) {
          await tx.contact.upsert({
            where: { id: contact.id },
            update: contact,
            create: contact,
          })
        }
      }

      // 10. Payouts
      if (data.payouts) {
        for (const payout of data.payouts) {
          await tx.payout.upsert({
            where: { id: payout.id },
            update: payout,
            create: payout,
          })
        }
      }

      // 11. Owner Transactions
      if (data.ownerTransactions) {
        for (const transaction of data.ownerTransactions) {
          await tx.ownerTransaction.upsert({
            where: { id: transaction.id },
            update: transaction,
            create: transaction,
          })
        }
      }

      // 12. Recurring Tasks
      if (data.recurringTasks) {
        for (const recurringTask of data.recurringTasks) {
          await tx.recurringTask.upsert({
            where: { id: recurringTask.id },
            update: recurringTask,
            create: recurringTask,
          })
        }
      }

      // 13. Reports
      if (data.reports) {
        for (const report of data.reports) {
          await tx.report.upsert({
            where: { id: report.id },
            update: report,
            create: report,
          })
        }
      }

      // 14. Cleaning Checklists
      if (data.cleaningChecklists) {
        for (const checklist of data.cleaningChecklists) {
          await tx.cleaningChecklist.upsert({
            where: { id: checklist.id },
            update: checklist,
            create: checklist,
          })
        }
      }

      // 15. Electricity Meter Readings
      if (data.electricityMeterReadings) {
        for (const reading of data.electricityMeterReadings) {
          await tx.electricityMeterReading.upsert({
            where: { id: reading.id },
            update: reading,
            create: reading,
          })
        }
      }

      // 16. Electricity Alerts
      if (data.electricityAlerts) {
        for (const alert of data.electricityAlerts) {
          await tx.electricityAlert.upsert({
            where: { id: alert.id },
            update: alert,
            create: alert,
          })
        }
      }

      // 17. Inventory Items
      if (data.inventoryItems) {
        for (const item of data.inventoryItems) {
          const { History, ...itemData } = item
          await tx.inventoryItem.upsert({
            where: { id: itemData.id },
            update: itemData,
            create: itemData,
          })

          if (History && History.length > 0) {
            for (const history of History) {
              await tx.inventoryHistory.upsert({
                where: { id: history.id },
                update: history,
                create: history,
              })
            }
          }
        }
      }

      // 18. Workflows
      if (data.workflows) {
        for (const workflow of data.workflows) {
          await tx.workflowRule.upsert({
            where: { id: workflow.id },
            update: workflow,
            create: workflow,
          })
        }
      }

      // 19. Workflow Executions
      if (data.workflowExecutions) {
        for (const execution of data.workflowExecutions) {
          await tx.workflowExecution.upsert({
            where: { id: execution.id },
            update: execution,
            create: execution,
          })
        }
      }

      // 20. Conversations
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

      // 21. Notifications
      if (data.notifications) {
        for (const notification of data.notifications) {
          await tx.notification.upsert({
            where: { id: notification.id },
            update: notification,
            create: notification,
          })
        }
      }

      // 22. AI Insight Cache
      if (data.aiInsightCache) {
        for (const cache of data.aiInsightCache) {
          await tx.aiInsightCache.upsert({
            where: { id: cache.id },
            update: cache,
            create: cache,
          })
        }
      }

      // 23. Email Templates
      if (data.emailTemplates) {
        for (const template of data.emailTemplates) {
          await tx.emailTemplate.upsert({
            where: { id: template.id },
            update: template,
            create: template,
          })
        }
      }

      // 24. SMS Templates
      if (data.smsTemplates) {
        for (const template of data.smsTemplates) {
          await tx.sMSTemplate.upsert({
            where: { id: template.id },
            update: template,
            create: template,
          })
        }
      }

      // 25. Settings (non-sensitive)
      if (data.settings) {
        for (const setting of data.settings) {
          await tx.setting.upsert({
            where: { key: setting.key },
            update: setting,
            create: setting,
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully',
    })
  } catch (error: any) {
    console.error('Restore error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to restore backup' },
      { status: 500 }
    )
  }
}
