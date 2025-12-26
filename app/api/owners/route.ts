import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { Currency } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    const owners = await prisma.owner.findMany({
      include: {
        User: true,
        Property: true,
        OwnerWallet: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(owners)
  } catch (error: any) {
    console.error('Owners API error:', error)
    const status = error.status || 500
    return NextResponse.json(
      { error: error.message || 'Failed to fetch owners' },
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    
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
      createUser,
      password,
    } = body

    const ownerId = crypto.randomUUID()
    const now = new Date()

    // Create owner
    const ownerData: any = {
      id: ownerId,
      updatedAt: now,
      name,
      email,
      phoneNumber,
      whatsappNumber,
      preferredChannel,
      preferredCurrency: preferredCurrency || Currency.GHS,
      payoutDetails,
      status: status || 'active',
      notes,
      OwnerWallet: {
        create: {
          id: crypto.randomUUID(),
          updatedAt: now,
          currentBalance: 0,
          commissionsPayable: 0,
        },
      },
    }

    // If creating user account
    if (createUser && password) {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.default.hash(password, 10)
      
      ownerData.User = {
        create: {
          id: crypto.randomUUID(),
          updatedAt: now,
          email,
          password: hashedPassword,
          role: 'OWNER',
          name,
        },
      }
    }

    const owner = await prisma.owner.create({
      data: ownerData,
      include: {
        User: true,
        OwnerWallet: true,
      },
    })

    return NextResponse.json(owner, { status: 201 })
  } catch (error: any) {
    console.error('Create owner error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create owner' },
      { status: 500 }
    )
  }
}

