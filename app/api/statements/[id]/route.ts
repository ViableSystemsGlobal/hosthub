import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'

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

    const statement = await prisma.statement.findUnique({
      where: { id },
      include: {
        Owner: true,
        StatementLine: true,
      },
    })

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    // Owners can only see their own statements
    if (user.role === 'OWNER' && statement.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get owner wallet for commissions payable
    const wallet = await prisma.ownerWallet.findUnique({
      where: { ownerId: statement.ownerId },
    })

    return NextResponse.json({
      ...statement,
      owner: statement.Owner,
      statementLines: statement.StatementLine,
      commissionsPayable: wallet?.commissionsPayable || 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch statement' },
      { status: 500 }
    )
  }
}

