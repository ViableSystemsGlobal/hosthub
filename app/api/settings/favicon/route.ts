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
    const file = formData.get('favicon') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type - favicon should be ICO, PNG, or SVG
    const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only ICO, PNG, and SVG are allowed for favicons' },
        { status: 400 }
      )
    }

    // Validate file size (2MB max for favicon)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'favicon')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Delete old favicon if exists
    const oldFaviconSetting = await prisma.setting.findUnique({
      where: { key: 'APP_FAVICON' },
    })
    
    if (oldFaviconSetting?.value) {
      const oldFaviconPath = join(process.cwd(), 'public', oldFaviconSetting.value)
      if (existsSync(oldFaviconPath)) {
        try {
          await unlink(oldFaviconPath)
        } catch (err) {
          console.error('Failed to delete old favicon:', err)
        }
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || (file.type.includes('svg') ? 'svg' : 'ico')
    const filename = `favicon-${timestamp}.${extension}`
    const filepath = join(uploadsDir, filename)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Save favicon URL to settings
    const faviconUrl = `/uploads/favicon/${filename}`
    await prisma.setting.upsert({
      where: { key: 'APP_FAVICON' },
      update: {
        value: faviconUrl,
        category: 'general',
        updatedAt: new Date(),
      },
      create: {
        key: 'APP_FAVICON',
        value: faviconUrl,
        category: 'general',
      },
    })

    return NextResponse.json({ faviconUrl })
  } catch (error: any) {
    console.error('Failed to upload favicon:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload favicon' },
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
    // Get current favicon setting
    const faviconSetting = await prisma.setting.findUnique({
      where: { key: 'APP_FAVICON' },
    })

    if (faviconSetting?.value) {
      // Delete file
      const filepath = join(process.cwd(), 'public', faviconSetting.value)
      if (existsSync(filepath)) {
        await unlink(filepath)
      }

      // Delete setting
      await prisma.setting.delete({
        where: { key: 'APP_FAVICON' },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete favicon:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete favicon' },
      { status: 500 }
    )
  }
}

