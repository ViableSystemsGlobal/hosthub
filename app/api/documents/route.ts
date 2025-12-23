import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { DocumentType } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const ownerId = searchParams.get('ownerId')
    const bookingId = searchParams.get('bookingId')
    const expenseId = searchParams.get('expenseId')
    const type = searchParams.get('type')

    const where: any = {}

    // Role-based filtering
    if (user.role === 'OWNER' && user.ownerId) {
      where.ownerId = user.ownerId
    } else if (user.role === 'MANAGER') {
      // Managers can only see documents for their assigned properties
      const assignedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      }).catch((error) => {
        console.error('Error fetching assigned properties:', error)
        return []
      })
      const propertyIds = assignedProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        // No assigned properties, return empty result
        return NextResponse.json([])
      }
      // If filtering by propertyId, verify it's in their assigned properties
      if (propertyId) {
        if (!propertyIds.includes(propertyId)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        where.propertyId = propertyId
      } else {
        // Otherwise, filter to only their assigned properties
        where.propertyId = { in: propertyIds }
      }
    } else {
      // Admins can filter freely
      if (propertyId) where.propertyId = propertyId
      if (ownerId) where.ownerId = ownerId
      if (bookingId) where.bookingId = bookingId
      if (expenseId) where.expenseId = expenseId
    }

    // Apply additional filters for non-manager roles
    if (user.role !== 'MANAGER') {
      if (ownerId) where.ownerId = ownerId
      if (bookingId) where.bookingId = bookingId
      if (expenseId) where.expenseId = expenseId
    }

    if (type && Object.values(DocumentType).includes(type as DocumentType)) {
      where.type = type as DocumentType
    }

    // Check if prisma.document exists (in case Prisma client needs regeneration)
    if (!prisma.document) {
      console.error('Prisma Document model not available. Please restart the server after running: npm run db:generate')
      return NextResponse.json(
        { error: 'Document model not available. Please restart the server.' },
        { status: 500 }
      )
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        Property: {
          select: { id: true, name: true },
        },
        Owner: {
          select: { id: true, name: true },
        },
        Booking: {
          select: { id: true, guestName: true, checkInDate: true },
        },
        Expense: {
          select: { id: true, description: true, date: true },
        },
        User: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error: any) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch documents' },
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

    // Only admins, managers, and finance can upload documents
    if (user.role === 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const propertyId = formData.get('propertyId') as string | null
    const ownerId = formData.get('ownerId') as string | null
    const bookingId = formData.get('bookingId') as string | null
    const expenseId = formData.get('expenseId') as string | null
    const type = formData.get('type') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const file = formData.get('file') as File | null

    if (!file || !type || !title) {
      return NextResponse.json(
        { error: 'File, type, and title are required' },
        { status: 400 }
      )
    }

    // At least one relation must be specified
    if (!propertyId && !ownerId && !bookingId && !expenseId) {
      return NextResponse.json(
        { error: 'At least one relation (property, owner, booking, or expense) is required' },
        { status: 400 }
      )
    }

    // Verify access
    if (user.role === 'MANAGER') {
      if (propertyId) {
        const property = await prisma.property.findUnique({
          where: { id: propertyId },
        })
        if (!property || property.managerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    // Handle file upload
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents')
    await mkdir(uploadDir, { recursive: true })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}-${sanitizedName}`
    const filepath = join(uploadDir, filename)

    await writeFile(filepath, buffer)

    // Create document record
    const document = await prisma.document.create({
      data: {
        id: crypto.randomUUID(),
        propertyId: propertyId || null,
        ownerId: ownerId || null,
        bookingId: bookingId || null,
        expenseId: expenseId || null,
        type: type as DocumentType,
        title,
        fileName: file.name,
        fileUrl: `/uploads/documents/${filename}`,
        fileSize: file.size,
        mimeType: file.type,
        description: description || null,
        uploadedById: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        Property: {
          select: { id: true, name: true },
        },
        Owner: {
          select: { id: true, name: true },
        },
        Booking: {
          select: { id: true, guestName: true },
        },
        Expense: {
          select: { id: true, description: true },
        },
        User: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(document)
  } catch (error: any) {
    console.error('Failed to create document:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create document' },
      { status: 500 }
    )
  }
}

