// Script to clear all data except User and Setting tables
// Run with: npx tsx scripts/clear-data.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearData() {
  console.log('Starting data cleanup...')
  console.log('This will delete ALL data except User and Setting tables.')
  console.log('')

  try {
    // Delete in order of dependencies (children first, then parents)
    
    console.log('Deleting StatementLine...')
    await prisma.statementLine.deleteMany({})
    
    console.log('Deleting Statement...')
    await prisma.statement.deleteMany({})
    
    console.log('Deleting OwnerTransaction...')
    await prisma.ownerTransaction.deleteMany({})
    
    console.log('Deleting OwnerWallet...')
    await prisma.ownerWallet.deleteMany({})
    
    console.log('Deleting Payout...')
    await prisma.payout.deleteMany({})
    
    console.log('Deleting Message...')
    await prisma.message.deleteMany({})
    
    console.log('Deleting Conversation...')
    await prisma.conversation.deleteMany({})
    
    console.log('Deleting Notification...')
    await prisma.notification.deleteMany({})
    
    console.log('Deleting AiInsightCache...')
    await prisma.aiInsightCache.deleteMany({})
    
    console.log('Deleting Report...')
    await prisma.report.deleteMany({})
    
    console.log('Deleting TaskChecklist...')
    await prisma.taskChecklist.deleteMany({})
    
    console.log('Deleting TaskAttachment...')
    await prisma.taskAttachment.deleteMany({})
    
    console.log('Deleting Task...')
    await prisma.task.deleteMany({})
    
    console.log('Deleting RecurringTask...')
    await prisma.recurringTask.deleteMany({})
    
    console.log('Deleting CleaningChecklist...')
    await prisma.cleaningChecklist.deleteMany({})
    
    console.log('Deleting ElectricityAlert...')
    await prisma.electricityAlert.deleteMany({})
    
    console.log('Deleting ElectricityMeterReading...')
    await prisma.electricityMeterReading.deleteMany({})
    
    console.log('Deleting IssueComment...')
    await prisma.issueComment.deleteMany({})
    
    console.log('Deleting IssueAttachment...')
    await prisma.issueAttachment.deleteMany({})
    
    console.log('Deleting Issue...')
    await prisma.issue.deleteMany({})
    
    console.log('Deleting InventoryHistory...')
    await prisma.inventoryHistory.deleteMany({})
    
    console.log('Deleting InventoryItem...')
    await prisma.inventoryItem.deleteMany({})
    
    console.log('Deleting Document...')
    await prisma.document.deleteMany({})
    
    console.log('Deleting Expense...')
    await prisma.expense.deleteMany({})
    
    console.log('Deleting Booking...')
    await prisma.booking.deleteMany({})
    
    console.log('Deleting Property...')
    await prisma.property.deleteMany({})
    
    console.log('Deleting Contact...')
    await prisma.contact.deleteMany({})
    
    console.log('Deleting WorkflowExecution...')
    await prisma.workflowExecution.deleteMany({})
    
    console.log('Deleting WorkflowRule...')
    await prisma.workflowRule.deleteMany({})
    
    console.log('Deleting EmailTemplate...')
    await prisma.emailTemplate.deleteMany({})
    
    console.log('Deleting SMSTemplate...')
    await prisma.sMSTemplate.deleteMany({})
    
    console.log('Deleting Owner...')
    await prisma.owner.deleteMany({})

    console.log('')
    console.log('✅ Data cleanup complete!')
    console.log('Preserved: User, Setting tables')
    
  } catch (error) {
    console.error('Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

