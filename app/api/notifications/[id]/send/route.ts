import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications/service'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAdmin()
    
    // Fetch the notification
    const notification = await prisma.notification.findUnique({
      where: { id },
    })
    
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    
    const payload = notification.payload as any
    
    // Resend using the stored payload
    await sendNotification({
      ownerId: notification.ownerId,
      type: notification.type as any,
      channels: [notification.channel as any],
      title: payload.title || 'Notification',
      message: payload.message || '',
      ...payload,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    )
  }
}

