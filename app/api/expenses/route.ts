import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { convertCurrency } from '@/lib/currency'
import { ExpenseCategory, Currency } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const ownerId = searchParams.get('ownerId')
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    
    // Owners can only see their own expenses
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'No owner linked' }, { status: 403 })
      }
      where.ownerId = user.ownerId
    } else if (user.role === 'MANAGER' || user.role === 'GENERAL_MANAGER') {
      // Managers and general managers can only see expenses for their assigned properties
      const assignedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const propertyIds = assignedProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json([])
      }
      where.propertyId = { in: propertyIds }
      if (propertyId && propertyIds.includes(propertyId)) {
        where.propertyId = propertyId
      }
    } else {
      if (propertyId) where.propertyId = propertyId
      if (ownerId) where.ownerId = ownerId
    }
    
    if (category) where.category = category as ExpenseCategory
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        Property: true,
        Owner: true,
        Task: true,
      },
      orderBy: { date: 'desc' },
      // Remove limit for PDF exports to get all receipts
      ...(searchParams.get('withReceipts') === 'true' ? {} : { take: 100 }),
    })

    return NextResponse.json(expenses)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch expenses' },
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

    // Only admins and managers can create expenses
    if (!['MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const formData = await request.formData()
    const propertyId = formData.get('propertyId') as string
    const category = formData.get('category') as string
    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    const currency = formData.get('currency') as string
    const date = formData.get('date') as string
    const paidBy = formData.get('paidBy') as string
    const linkedTaskId = formData.get('linkedTaskId') as string | null
    const file = formData.get('file') as File | null

    // Get property to get owner
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { Owner: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // If manager or general manager, verify they manage this property
    if ((user.role === 'MANAGER' || user.role === 'GENERAL_MANAGER') && property.managerId !== user.id) {
      return NextResponse.json({ error: 'You can only create expenses for properties you manage' }, { status: 403 })
    }

    // Handle file upload
    let attachmentUrl: string | null = null
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'receipts')
      await mkdir(uploadDir, { recursive: true })
      
      const filename = `${Date.now()}-${file.name}`
      const filepath = join(uploadDir, filename)
      await writeFile(filepath, buffer)
      
      attachmentUrl = `/uploads/receipts/${filename}`
    }

    const fxRate = 1.0 // Should be fetched from FX service
    const amountInBase = await convertCurrency(amount, currency as Currency)

    const expense = await prisma.expense.create({
      data: {
        id: crypto.randomUUID(),
        propertyId,
        ownerId: property.ownerId,
        date: new Date(date),
        category: category as ExpenseCategory,
        description,
        amount,
        currency: currency as Currency,
        fxRateToBase: fxRate,
        amountInBase,
        paidBy,
        linkedTaskId,
        attachmentUrl,
        updatedAt: new Date(),
      },
      include: {
        Property: true,
        Owner: true,
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create expense' },
      { status: 500 }
    )
  }
}

