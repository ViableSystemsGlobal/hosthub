import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // @ts-ignore - WorkflowExecution model may not be in types yet
    const executions = await (prisma as any).workflowExecution.findMany({
      where: { workflowRuleId: id },
      orderBy: { executedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // @ts-ignore - WorkflowExecution model may not be in types yet
    const total = await (prisma as any).workflowExecution.count({
      where: { workflowRuleId: id },
    })

    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    })
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to fetch workflow executions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow executions' },
      { status: 500 }
    )
  }
}

