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
    const status = searchParams.get('status')

    const where: any = {}
    
    // Owners can only see their own statements
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'No owner linked' }, { status: 403 })
      }
      where.ownerId = user.ownerId
    } else {
      if (ownerId) where.ownerId = ownerId
    }
    
    if (status) where.status = status

    const statements = await prisma.statement.findMany({
      where,
      include: {
        Owner: true,
      },
      orderBy: { periodEnd: 'desc' },
    })

    return NextResponse.json(statements)
  } catch (error: any) {
    console.error('Failed to fetch statements:', error)
    // Return empty array to prevent frontend errors
    return NextResponse.json([])
  }
}

