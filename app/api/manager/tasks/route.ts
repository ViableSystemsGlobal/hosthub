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

    // Get properties assigned to this manager
    const assignedProperties = await prisma.property.findMany({
      where: {
        managerId: user.id,
      },
      select: {
        id: true,
      },
    })

    const propertyIds = assignedProperties.map(p => p.id)

    if (propertyIds.length === 0) {
      return NextResponse.json([])
    }

    // Get tasks for assigned properties
    const tasks = await prisma.task.findMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
      },
      include: {
        Property: true,
      },
      orderBy: { dueAt: 'desc' },
    })

    return NextResponse.json(tasks)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

