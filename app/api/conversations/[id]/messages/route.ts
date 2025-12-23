import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { Owner: true },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Owners can only see their own conversations
    // Managers can see conversations for properties they manage
    if (user.role === 'OWNER' && conversation.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'MANAGER') {
      const managedProperty = await prisma.property.findFirst({
        where: {
          managerId: user.id,
          ownerId: conversation.ownerId,
        },
      })
      if (!managedProperty) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Mark messages as read for the current user
    if (user.role !== 'OWNER') {
      // Admin/Manager reading - mark owner messages as read
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderType: 'owner',
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      })
    }

    return NextResponse.json(messages)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { content, attachments } = body

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { Owner: true },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Owners can only message in their own conversations
    // Managers can message in conversations for properties they manage
    if (user.role === 'OWNER' && conversation.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (user.role === 'MANAGER') {
      const managedProperty = await prisma.property.findFirst({
        where: {
          managerId: user.id,
          ownerId: conversation.ownerId,
        },
      })
      if (!managedProperty) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const senderType = user.role === 'OWNER' ? 'owner' : (user.role === 'MANAGER' ? 'manager' : 'admin')
    
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderType,
        senderId: user.id,
        content,
        attachments: attachments || [],
      },
    })

    // Update conversation last message time
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    )
  }
}

