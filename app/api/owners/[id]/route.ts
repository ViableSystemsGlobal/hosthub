import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { Currency } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
    const { id } = await params
    
    const owner = await prisma.owner.findUnique({
      where: { id },
      include: {
        User: true,
        Property: true,
        OwnerWallet: true,
        Booking: {
          take: 10,
          orderBy: { checkInDate: 'desc' },
          include: {
            Property: true,
          },
        },
      },
    })

    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    return NextResponse.json(owner)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch owner' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
    const { id } = await params
    
    const body = await request.json()
    const {
      name,
      email,
      phoneNumber,
      whatsappNumber,
      preferredChannel,
      preferredCurrency,
      payoutDetails,
      status,
      notes,
    } = body

    const owner = await prisma.owner.update({
      where: { id },
      data: {
        name,
        email,
        phoneNumber,
        whatsappNumber,
        preferredChannel,
        preferredCurrency,
        payoutDetails,
        status,
        notes,
      },
      include: {
        User: true,
        OwnerWallet: true,
      },
    })

    return NextResponse.json(owner)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update owner' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
    const { id } = await params
    
    await prisma.owner.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete owner' },
      { status: 500 }
    )
  }
}

