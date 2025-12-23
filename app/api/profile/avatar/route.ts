import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'

// POST upload profile image
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB for profile images)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Get existing user to check for old image
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    })

    // Delete old image if it exists
    if (existingUser?.image) {
      try {
        const oldImagePath = join(process.cwd(), 'public', existingUser.image)
        await unlink(oldImagePath).catch(() => {
          // Ignore errors if file doesn't exist
        })
      } catch (error) {
        // Ignore errors when deleting old image
      }
    }

    // Save new image
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'profiles')
    await mkdir(uploadDir, { recursive: true })
    
    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${user.id}-${timestamp}-${sanitizedName}`
    const filepath = join(uploadDir, filename)
    
    await writeFile(filepath, buffer)
    
    const url = `/uploads/profiles/${filename}`

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: { image: url },
    })
    
    return NextResponse.json({ url }, { status: 200 })
  } catch (error: any) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    )
  }
}

// DELETE remove profile image
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    })

    if (existingUser?.image) {
      try {
        const imagePath = join(process.cwd(), 'public', existingUser.image)
        await unlink(imagePath).catch(() => {
          // Ignore errors if file doesn't exist
        })
      } catch (error) {
        // Ignore errors when deleting image
      }
    }

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: { image: null },
    })
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Avatar delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete image' },
      { status: 500 }
    )
  }
}

