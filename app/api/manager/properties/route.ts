import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isManager } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isManager(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get only properties assigned to this manager
    const properties = await prisma.property.findMany({
      where: {
        managerId: user.id,
      },
      include: {
        Owner: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(properties)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}

