import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const ownerId = searchParams.get('ownerId')

    const where: any = {}
    
    // Owners can only see their own conversations
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'No owner linked' }, { status: 403 })
      }
      where.ownerId = user.ownerId
    } else if (user.role === 'MANAGER') {
      // Managers can see conversations for properties they manage
      const managedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { ownerId: true },
      })
      const ownerIds = [...new Set(managedProperties.map(p => p.ownerId))]
      if (ownerIds.length === 0) {
        return NextResponse.json([])
      }
      where.ownerId = { in: ownerIds }
      if (ownerId && ownerIds.includes(ownerId)) {
        where.ownerId = ownerId
      }
    } else {
      // Admin can filter by ownerId
      if (ownerId) where.ownerId = ownerId
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        Owner: true,
        Message: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    return NextResponse.json(conversations)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
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

    const body = await request.json()
    const { ownerId, propertyId, initialMessage } = body

    // Owners can only create conversations for themselves
    if (user.role === 'OWNER') {
      if (ownerId !== user.ownerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        id: crypto.randomUUID(),
        ownerId,
        propertyId,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    })

    // Create initial message if provided
    if (initialMessage) {
      const senderType = user.role === 'OWNER' ? 'owner' : (user.role === 'MANAGER' ? 'manager' : 'admin')
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType,
          senderId: user.id,
          content: initialMessage,
        },
      })
    }

    return NextResponse.json(conversation, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create conversation' },
      { status: 500 }
    )
  }
}

