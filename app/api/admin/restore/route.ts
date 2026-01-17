import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import fs from 'fs'

const execAsync = promisify(exec)

interface BackupFile {
  path: string
  name: string
  data: string // Base64 encoded
  mimeType: string
}

/**
 * POST - Restore database and files from backup
 * Supports both JSON format (v1.0, v1.1) and archive format (v2.0 - tar.gz/zip)
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
    const contentType = request.headers.get('content-type') || ''
    console.log('Restore request Content-Type:', contentType)
    
    // Check if it's a file upload (archive)
    // FormData requests will have multipart/form-data in Content-Type (case-insensitive)
    if (contentType.toLowerCase().includes('multipart/form-data')) {
      console.log('Detected FormData, restoring from archive')
      return await restoreFromArchive(request)
    }
    
    // If Content-Type is application/json, it's definitely JSON
    if (contentType.includes('application/json')) {
      console.log('Detected JSON, restoring from JSON')
      return await restoreFromJSON(request)
    }
    
    // If Content-Type is missing or unknown, return an error
    // This prevents accidentally consuming the request body
    return NextResponse.json(
      { error: `Invalid Content-Type: ${contentType || 'missing'}. Expected multipart/form-data for archive files or application/json for JSON files.` },
      { status: 400 }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Restore error:', error)
    return NextResponse.json(
      { error: err.message || 'Failed to restore backup' },
      { status: 500 }
    )
  }
}

/**
 * Restore from archive file (tar.gz or zip)
 */
async function restoreFromArchive(request: NextRequest, providedFormData?: FormData) {
  const formData = providedFormData || await request.formData()
  const file = formData.get('file') as File | null
  const clearExistingParam = formData.get('clearExisting')
  const clearExisting = clearExistingParam === 'true' || clearExistingParam === true
  
  // Track restore results for verification
  let bookingsBefore = 0
  let bookingsAfter: number | undefined
  let propertiesAfter: number | undefined
  let ownersAfter: number | undefined

  if (!file) {
    console.error('Restore error: No file found in FormData')
    return NextResponse.json(
      { error: 'No backup file provided. Please select a .tar.gz, .zip, or .json backup file.' },
      { status: 400 }
    )
  }

  console.log('Restoring archive file:', file.name, 'Size:', file.size, 'Type:', file.type)

  // Validate file extension
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.tar.gz') && !fileName.endsWith('.zip') && !fileName.endsWith('.json')) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.name}. Expected .tar.gz, .zip, or .json file.` },
      { status: 400 }
    )
  }

  const tempDir = join(tmpdir(), `hosthub-restore-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  try {
    // Save uploaded file - use a safe filename to avoid shell injection
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const archivePath = join(tempDir, safeFileName)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(archivePath, buffer)

    // Extract archive
    const extractCmd = safeFileName.endsWith('.zip')
      ? `cd "${tempDir}" && unzip -q "${safeFileName}" -d "${tempDir}"`
      : safeFileName.endsWith('.tar.gz')
      ? `cd "${tempDir}" && tar -xzf "${safeFileName}"`
      : null

    if (!extractCmd) {
      throw new Error(`Unsupported archive format: ${file.name}`)
    }

    console.log('Extracting archive with command:', extractCmd)
    await execAsync(extractCmd)

    // Check for database.sql (pg_dump format) or database.json
    const sqlDump = join(tempDir, 'database.sql')
    const jsonDump = join(tempDir, 'database.json')
    const uploadsDir = join(tempDir, 'uploads')

    // Restore database
    if (fs.existsSync(sqlDump)) {
      console.log('Found database.sql dump, restoring...')
      
      // Check data before restore
      try {
        bookingsBefore = await prisma.booking.count()
        console.log(`Bookings before restore: ${bookingsBefore}`)
      } catch (e) {
        console.warn('Could not check bookings before restore:', e)
      }
      
      // Restore from SQL dump
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        throw new Error('DATABASE_URL not configured')
      }

      const url = new URL(dbUrl)
      const dbUser = url.username
      const dbPassword = url.password
      const dbHost = url.hostname
      const dbPort = url.port || '5432'
      const dbName = url.pathname.slice(1)

      // Check if dump is custom format (binary) or plain SQL
      // Custom format dumps start with "PGDMP" magic bytes
      const dumpBuffer = await readFile(sqlDump)
      const isCustomFormat = dumpBuffer.slice(0, 5).toString() === 'PGDMP'

      if (isCustomFormat) {
        // Custom format dump - use pg_restore
        console.log('Detected custom format dump, using pg_restore')
        // Use --clean to drop objects, --if-exists to avoid errors, --no-owner --no-acl for compatibility
        // Use --verbose to see what's happening
        const restoreCmd = `PGPASSWORD="${dbPassword}" pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists --no-owner --no-acl --verbose "${sqlDump}" 2>&1`
        
        try {
          console.log('Running pg_restore...')
          const result = await execAsync(restoreCmd)
          console.log('pg_restore stdout:', result.stdout)
          // Check if restore actually worked by looking for errors in output
          if (result.stdout.includes('ERROR') || result.stdout.includes('FATAL')) {
            console.error('pg_restore reported errors in output:', result.stdout)
            throw new Error('pg_restore completed but reported errors. Check logs above.')
          }
          console.log('pg_restore completed successfully')
        } catch (restoreError: any) {
          console.error('pg_restore failed:', restoreError.message)
          console.error('stderr:', restoreError.stderr)
          console.error('stdout:', restoreError.stdout)
          throw new Error(`Failed to restore database: ${restoreError.message}. Make sure pg_restore is available.`)
        }
      } else {
        // Plain SQL dump - use psql
        console.log('Detected plain SQL dump, using psql')
        const psqlCmd = `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${sqlDump}"`
        
        try {
          console.log('Running psql...')
          const result = await execAsync(psqlCmd)
          console.log('psql output:', result.stdout)
          if (result.stderr) {
            console.warn('psql warnings:', result.stderr)
          }
        } catch (psqlError: any) {
          console.error('psql failed:', psqlError.message)
          console.error('stderr:', psqlError.stderr)
          throw new Error(`Failed to restore database: ${psqlError.message}`)
        }
      }
      
      console.log('Database restore completed successfully')
      
      // Verify restore by checking if data exists
      try {
        bookingsAfter = await prisma.booking.count()
        propertiesAfter = await prisma.property.count()
        ownersAfter = await prisma.owner.count()
        console.log(`Verification after restore:`)
        console.log(`  - Bookings: ${bookingsAfter} (was ${bookingsBefore})`)
        console.log(`  - Properties: ${propertiesAfter}`)
        console.log(`  - Owners: ${ownersAfter}`)
        
        if (bookingsAfter === 0 && bookingsBefore > 0) {
          console.error('ERROR: All bookings were lost during restore!')
          throw new Error('Restore completed but all bookings were lost. The restore may have failed silently.')
        }
      } catch (verifyError: any) {
        console.error('Verification query failed:', verifyError)
        if (verifyError.message.includes('lost during restore')) {
          throw verifyError
        }
        // Don't fail the restore if verification query fails for other reasons
      }
    } else if (fs.existsSync(jsonDump)) {
      // Restore from JSON (fallback)
      console.log('Found database.json dump, restoring...')
      const jsonContent = await readFile(jsonDump, 'utf-8')
      const backup = JSON.parse(jsonContent)
      await restoreDatabaseData(backup, clearExisting)
      
      // Verify JSON restore
      try {
        bookingsAfter = await prisma.booking.count()
        propertiesAfter = await prisma.property.count()
        ownersAfter = await prisma.owner.count()
        console.log(`Verification after JSON restore:`)
        console.log(`  - Bookings: ${bookingsAfter}`)
        console.log(`  - Properties: ${propertiesAfter}`)
        console.log(`  - Owners: ${ownersAfter}`)
      } catch (verifyError) {
        console.error('Verification query failed:', verifyError)
      }
    } else {
      throw new Error('No database dump found in archive (expected database.sql or database.json)')
    }

    // Restore files
    let filesRestored = 0
    if (fs.existsSync(uploadsDir)) {
      const publicUploads = join(process.cwd(), 'public', 'uploads')
      await mkdir(publicUploads, { recursive: true })
      
      const copyCmd = `cp -r "${uploadsDir}"/* "${publicUploads}"/ 2>/dev/null || true`
      await execAsync(copyCmd)
      
      // Count files
      const countCmd = `find "${uploadsDir}" -type f | wc -l`
      const result = await execAsync(countCmd)
      filesRestored = parseInt(result.stdout.trim()) || 0
    }

    // Clean up
    await execAsync(`rm -rf "${tempDir}"`).catch(() => {})

    // Build success message with verification
    let message = 'Backup restored successfully.'
    if (filesRestored > 0) {
      message += ` ${filesRestored} files restored.`
    }
    if (typeof bookingsAfter !== 'undefined') {
      message += ` Database: ${bookingsAfter} bookings, ${propertiesAfter} properties, ${ownersAfter} owners.`
    }

    return NextResponse.json({
      success: true,
      message: message.trim(),
      filesRestored,
      bookingsRestored: bookingsAfter,
      propertiesRestored: propertiesAfter,
      ownersRestored: ownersAfter,
    })
  } catch (error: unknown) {
    await execAsync(`rm -rf "${tempDir}"`).catch(() => {})
    throw error
  }
}

/**
 * Restore from JSON format (backward compatibility)
 */
async function restoreFromJSON(request: NextRequest) {
  const body = await request.json()
  const { backup, clearExisting = false } = body

  if (!backup || !backup.data) {
    return NextResponse.json(
      { error: 'Invalid backup format' },
      { status: 400 }
    )
  }

  // Validate backup version (support 1.0, 1.1, and 2.0)
  if (!['1.0', '1.1', '2.0'].includes(backup.version)) {
    return NextResponse.json(
      { error: 'Unsupported backup version' },
      { status: 400 }
    )
  }

  await restoreDatabaseData(backup, clearExisting)

  // Restore files if present (v1.1+)
  let filesRestored = 0
  let filesSkipped = 0
  
  if (backup.files && Array.isArray(backup.files)) {
    const publicDir = join(process.cwd(), 'public')
    
    for (const file of backup.files as BackupFile[]) {
      try {
        const fullPath = join(publicDir, file.path)
        const dirPath = dirname(fullPath)
        await mkdir(dirPath, { recursive: true })
        
        const buffer = Buffer.from(file.data, 'base64')
        await writeFile(fullPath, buffer)
        
        filesRestored++
      } catch (fileError) {
        console.error(`Failed to restore file ${file.path}:`, fileError)
        filesSkipped++
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
}

/**
 * Restore database data from backup object
 */
async function restoreDatabaseData(backup: any, clearExisting: boolean) {
  await prisma.$transaction(async (tx) => {
    // Clear existing data if requested
    if (clearExisting) {
      await tx.inventoryHistory.deleteMany({})
      await tx.electricityAlert.deleteMany({})
      await tx.message.deleteMany({})
      await tx.statementLine.deleteMany({})
      await tx.issueComment.deleteMany({})
      await tx.issueAttachment.deleteMany({})
      await tx.taskAttachment.deleteMany({})
      await tx.taskChecklist.deleteMany({})
      await tx.workflowExecution.deleteMany({})
      
      await tx.inventoryItem.deleteMany({})
      await tx.electricityMeterReading.deleteMany({})
      await tx.conversation.deleteMany({})
      await tx.statement.deleteMany({})
      await tx.issue.deleteMany({})
      await tx.task.deleteMany({})
      await tx.cleaningChecklist.deleteMany({})
      await tx.workflowRule.deleteMany({})
      
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
      
      await tx.property.deleteMany({})
      await tx.ownerWallet.deleteMany({})
      await tx.emailTemplate.deleteMany({})
      await tx.sMSTemplate.deleteMany({})
      
      await tx.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } })
      await tx.owner.deleteMany({})
    }

    const { data } = backup

    // Restore in order of dependencies
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

    if (data.users) {
      for (const user of data.users) {
        const userData = { ...user }
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

    if (data.properties) {
      for (const property of data.properties) {
        const propertyData = { ...property }
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

    if (data.contacts) {
      for (const contact of data.contacts) {
        await tx.contact.upsert({
          where: { id: contact.id },
          update: contact,
          create: contact,
        })
      }
    }

    if (data.guestContacts) {
      for (const guestContact of data.guestContacts) {
        const gcData = { ...guestContact }
        if (gcData.propertyId) {
          const propertyExists = await tx.property.findUnique({
            where: { id: gcData.propertyId },
            select: { id: true },
          })
          if (!propertyExists) {
            gcData.propertyId = null
          }
        }
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

    if (data.bookings) {
      for (const booking of data.bookings) {
        const bookingData = { ...booking }
        if (bookingData.checkedInById) {
          const userExists = await tx.user.findUnique({
            where: { id: bookingData.checkedInById },
            select: { id: true },
          })
          if (!userExists) {
            bookingData.checkedInById = null
          }
        }
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

    if (data.tasks) {
      for (const task of data.tasks) {
        const { TaskAttachment, TaskChecklist, ...taskData } = task
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
          if (TaskChecklist.checklistId) {
            const clExists = await tx.cleaningChecklist.findUnique({
              where: { id: TaskChecklist.checklistId },
              select: { id: true },
            })
            if (clExists) {
              await tx.taskChecklist.upsert({
                where: { id: TaskChecklist.id },
                update: TaskChecklist,
                create: TaskChecklist,
              })
            }
          }
        }
      }
    }

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

    if (data.issues) {
      for (const issue of data.issues) {
        const { IssueAttachment, IssueComment, ...issueData } = issue
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
          }
        }
      }
    }

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

    if (data.payouts) {
      for (const payout of data.payouts) {
        await tx.payout.upsert({
          where: { id: payout.id },
          update: payout,
          create: payout,
        })
      }
    }

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

    if (data.electricityAlerts) {
      for (const alert of data.electricityAlerts) {
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

    if (data.workflowExecutions) {
      for (const execution of data.workflowExecutions) {
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

    if (data.notifications) {
      for (const notification of data.notifications) {
        await tx.notification.upsert({
          where: { id: notification.id },
          update: notification,
          create: notification,
        })
      }
    }

    if (data.aiInsightCache) {
      for (const cache of data.aiInsightCache) {
        await tx.aiInsightCache.upsert({
          where: { id: cache.id },
          update: cache,
          create: cache,
        })
      }
    }

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
    timeout: 300000, // 5 minute timeout for large restores
  })
}
