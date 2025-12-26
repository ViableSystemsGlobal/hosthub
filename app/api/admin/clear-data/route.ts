import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Confirm the action with a secret key
    const { confirmKey } = await request.json()
    
    if (confirmKey !== 'DELETE_ALL_DATA_CONFIRM') {
      return NextResponse.json({ 
        error: 'Invalid confirmation key. Send { "confirmKey": "DELETE_ALL_DATA_CONFIRM" }' 
      }, { status: 400 })
    }

    console.log('Starting data cleanup...')
    const deleted: Record<string, number> = {}

    // Delete in order of dependencies (children first, then parents)
    deleted.statementLine = (await prisma.statementLine.deleteMany({})).count
    deleted.statement = (await prisma.statement.deleteMany({})).count
    deleted.ownerTransaction = (await prisma.ownerTransaction.deleteMany({})).count
    deleted.ownerWallet = (await prisma.ownerWallet.deleteMany({})).count
    deleted.payout = (await prisma.payout.deleteMany({})).count
    deleted.message = (await prisma.message.deleteMany({})).count
    deleted.conversation = (await prisma.conversation.deleteMany({})).count
    deleted.notification = (await prisma.notification.deleteMany({})).count
    deleted.aiInsightCache = (await prisma.aiInsightCache.deleteMany({})).count
    deleted.report = (await prisma.report.deleteMany({})).count
    deleted.taskChecklist = (await prisma.taskChecklist.deleteMany({})).count
    deleted.taskAttachment = (await prisma.taskAttachment.deleteMany({})).count
    deleted.task = (await prisma.task.deleteMany({})).count
    deleted.recurringTask = (await prisma.recurringTask.deleteMany({})).count
    deleted.cleaningChecklist = (await prisma.cleaningChecklist.deleteMany({})).count
    deleted.electricityAlert = (await prisma.electricityAlert.deleteMany({})).count
    deleted.electricityMeterReading = (await prisma.electricityMeterReading.deleteMany({})).count
    deleted.issueComment = (await prisma.issueComment.deleteMany({})).count
    deleted.issueAttachment = (await prisma.issueAttachment.deleteMany({})).count
    deleted.issue = (await prisma.issue.deleteMany({})).count
    deleted.inventoryHistory = (await prisma.inventoryHistory.deleteMany({})).count
    deleted.inventoryItem = (await prisma.inventoryItem.deleteMany({})).count
    deleted.document = (await prisma.document.deleteMany({})).count
    deleted.expense = (await prisma.expense.deleteMany({})).count
    deleted.booking = (await prisma.booking.deleteMany({})).count
    deleted.property = (await prisma.property.deleteMany({})).count
    deleted.contact = (await prisma.contact.deleteMany({})).count
    deleted.workflowExecution = (await prisma.workflowExecution.deleteMany({})).count
    deleted.workflowRule = (await prisma.workflowRule.deleteMany({})).count
    deleted.emailTemplate = (await prisma.emailTemplate.deleteMany({})).count
    deleted.smsTemplate = (await prisma.sMSTemplate.deleteMany({})).count
    deleted.owner = (await prisma.owner.deleteMany({})).count

    console.log('Data cleanup complete:', deleted)

    return NextResponse.json({ 
      success: true, 
      message: 'All data cleared except User and Setting tables',
      deleted 
    })
  } catch (error: any) {
    console.error('Clear data error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to clear data' 
    }, { status: 500 })
  }
}

