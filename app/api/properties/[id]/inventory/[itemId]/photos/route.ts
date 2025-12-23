import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { UserRole } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireRole(
      [UserRole.MANAGER, UserRole.OPERATIONS, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      request
    )

    const { id, itemId } = await params

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        Property: {
          select: {
            managerId: true,
          },
        },
      },
    })

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    if (inventoryItem.propertyId !== id) {
      return NextResponse.json(
        { error: 'Inventory item does not belong to this property' },
        { status: 400 }
      )
    }

    if (inventoryItem.type !== 'STATIONARY') {
      return NextResponse.json(
        { error: 'Photos can only be added to stationary items' },
        { status: 400 }
      )
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && inventoryItem.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only add photos to inventory for properties you manage' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'inventory')
    await mkdir(uploadDir, { recursive: true })

    const uploadedPhotos = await Promise.all(
      files.map(async (file) => {
        if (file.size === 0) return null

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.type}. Only JPEG, PNG, and WebP are allowed.`)
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} exceeds 10MB limit`)
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filename = `${timestamp}-${sanitizedName}`
        const filepath = join(uploadDir, filename)

        await writeFile(filepath, buffer)

        return `/uploads/inventory/${filename}`
      })
    )

    const validPhotos = uploadedPhotos.filter(Boolean) as string[]
    if (validPhotos.length === 0) {
      return NextResponse.json(
        { error: 'No valid photos uploaded' },
        { status: 400 }
      )
    }

    // Update inventory item with new photos
    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        photos: {
          push: validPhotos,
        },
      },
      include: {
        LastCheckedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updated, { status: 201 })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to upload photos:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload photos' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireRole(
      [UserRole.MANAGER, UserRole.OPERATIONS, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      request
    )

    const { id, itemId } = await params
    const searchParams = request.nextUrl.searchParams
    const photoUrl = searchParams.get('photoUrl')

    if (!photoUrl) {
      return NextResponse.json(
        { error: 'Photo URL is required' },
        { status: 400 }
      )
    }

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        Property: {
          select: {
            managerId: true,
          },
        },
      },
    })

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    if (inventoryItem.propertyId !== id) {
      return NextResponse.json(
        { error: 'Inventory item does not belong to this property' },
        { status: 400 }
      )
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && inventoryItem.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete photos from inventory for properties you manage' },
        { status: 403 }
      )
    }

    // Remove photo from array
    const updatedPhotos = (inventoryItem.photos || []).filter((p) => p !== photoUrl)

    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        photos: updatedPhotos,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to delete photo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete photo' },
      { status: 500 }
    )
  }
}

