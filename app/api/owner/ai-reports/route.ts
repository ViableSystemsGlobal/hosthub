import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { initializeOwnerAIReportSchedule } from '@/lib/reports/owner-ai-reports'

/**
 * GET - Fetch owner's AI report preferences
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireOwner(request)
    
    const owner = await prisma.owner.findUnique({
      where: { id: user.ownerId! },
      select: {
        id: true,
        aiReportEnabled: true,
        aiReportFrequency: true,
        aiReportTime: true,
        aiReportLastSent: true,
        aiReportNextSend: true,
      },
    })

    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    return NextResponse.json({
      enabled: owner.aiReportEnabled || false,
      frequency: owner.aiReportFrequency || 'none',
      preferredTime: owner.aiReportTime || '08:00',
      lastSent: owner.aiReportLastSent,
      nextSend: owner.aiReportNextSend,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AI report preferences' },
      { status: error.status || 500 }
    )
  }
}

/**
 * PATCH - Update owner's AI report preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireOwner(request)
    const body = await request.json()
    const { enabled, frequency, preferredTime } = body

    // Validate frequency
    if (frequency && !['daily', 'weekly', 'none'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency. Must be "daily", "weekly", or "none"' },
        { status: 400 }
      )
    }

    // Validate time format (HH:mm)
    if (preferredTime && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(preferredTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Must be HH:mm (e.g., 08:00)' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (enabled !== undefined) updateData.aiReportEnabled = enabled
    if (frequency !== undefined) updateData.aiReportFrequency = frequency
    if (preferredTime !== undefined) updateData.aiReportTime = preferredTime

    const owner = await prisma.owner.update({
      where: { id: user.ownerId! },
      data: updateData,
      select: {
        id: true,
        aiReportEnabled: true,
        aiReportFrequency: true,
        aiReportTime: true,
        aiReportLastSent: true,
        aiReportNextSend: true,
      },
    })

    // Initialize schedule if enabled
    if (owner.aiReportEnabled && owner.aiReportFrequency && owner.aiReportFrequency !== 'none') {
      await initializeOwnerAIReportSchedule(owner.id)
    }

    return NextResponse.json({
      enabled: owner.aiReportEnabled || false,
      frequency: owner.aiReportFrequency || 'none',
      preferredTime: owner.aiReportTime || '08:00',
      lastSent: owner.aiReportLastSent,
      nextSend: owner.aiReportNextSend,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update AI report preferences' },
      { status: error.status || 500 }
    )
  }
}

