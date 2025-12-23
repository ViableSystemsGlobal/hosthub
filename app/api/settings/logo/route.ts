import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    const status = error.status || 401
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, and WebP are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'logo')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Delete old logo if exists
    const oldLogoSetting = await prisma.setting.findUnique({
      where: { key: 'APP_LOGO' },
    })
    
    if (oldLogoSetting?.value) {
      const oldLogoPath = join(process.cwd(), 'public', oldLogoSetting.value)
      if (existsSync(oldLogoPath)) {
        try {
          await unlink(oldLogoPath)
        } catch (err) {
          console.error('Failed to delete old logo:', err)
        }
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `logo-${timestamp}.${extension}`
    const filepath = join(uploadsDir, filename)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Save logo URL to settings
    const logoUrl = `/uploads/logo/${filename}`
    await prisma.setting.upsert({
      where: { key: 'APP_LOGO' },
      update: {
        value: logoUrl,
        category: 'general',
        updatedAt: new Date(),
      },
      create: {
        key: 'APP_LOGO',
        value: logoUrl,
        category: 'general',
      },
    })

    return NextResponse.json({ logoUrl })
  } catch (error: any) {
    console.error('Failed to upload logo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload logo' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    const status = error.status || 401
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status }
    )
  }

  try {
    // Get current logo setting
    const logoSetting = await prisma.setting.findUnique({
      where: { key: 'APP_LOGO' },
    })

    if (logoSetting?.value) {
      // Delete file
      const filepath = join(process.cwd(), 'public', logoSetting.value)
      if (existsSync(filepath)) {
        await unlink(filepath)
      }

      // Delete setting
      await prisma.setting.delete({
        where: { key: 'APP_LOGO' },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete logo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete logo' },
      { status: 500 }
    )
  }
}

