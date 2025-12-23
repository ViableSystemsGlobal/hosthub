import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { Currency } from '@prisma/client'

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
    
    // Owners can only see their own properties
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'Owner ID not found' }, { status: 403 })
      }
      where.ownerId = user.ownerId
    } else {
      // Admins can filter by ownerId if provided
      if (ownerId) where.ownerId = ownerId
    }
    
    if (status) where.status = status

    const properties = await prisma.property.findMany({
      where,
      include: {
        Owner: true,
        User: true, // manager relation
      },
      orderBy: { createdAt: 'desc' },
    })

    // Map the response to match frontend expectations
    const mappedProperties = properties.map(property => ({
      ...property,
      manager: property.User ? {
        id: property.User.id,
        name: property.User.name,
        email: property.User.email,
      } : null,
      User: undefined, // Remove the User field to avoid confusion
    }))

    return NextResponse.json(mappedProperties)
  } catch (error: any) {
    // Handle redirect errors (from auth helpers)
    if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    const body = await request.json()
    const {
      ownerId,
      managerId,
      name,
      nickname,
      address,
      city,
      country,
      currency,
      airbnbListingId,
      airbnbUrl,
      bookingComId,
      instagramHandle,
      defaultCommissionRate,
      cleaningFeeRules,
      status,
      photos,
      bedrooms,
      bathrooms,
      maxGuests,
      amenities,
      description,
    } = body

    // Validate required fields
    if (!ownerId) {
      return NextResponse.json({ error: 'Owner ID is required' }, { status: 400 })
    }

    // Verify owner exists
    const ownerExists = await prisma.owner.findUnique({ where: { id: ownerId } })
    if (!ownerExists) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    // Verify manager exists if provided
    if (managerId) {
      const managerExists = await prisma.user.findUnique({ where: { id: managerId } })
      if (!managerExists) {
        return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
      }
    }

    const property = await prisma.property.create({
      data: {
        id: crypto.randomUUID(),
        ownerId,
        managerId: managerId || null,
        name: name || 'Untitled Property',
        nickname: nickname || null,
        address: address || null,
        city: city || null,
        country: country || null,
        currency: currency || Currency.GHS,
        airbnbListingId: airbnbListingId || null,
        airbnbUrl: airbnbUrl || null,
        bookingComId: bookingComId || null,
        instagramHandle: instagramHandle || null,
        defaultCommissionRate: defaultCommissionRate || 0.15,
        cleaningFeeRules: cleaningFeeRules || null,
        status: status || 'active',
        photos: photos || [],
        bedrooms: bedrooms ? parseInt(String(bedrooms)) : null,
        bathrooms: bathrooms ? parseFloat(String(bathrooms)) : null,
        maxGuests: maxGuests ? parseInt(String(maxGuests)) : null,
        amenities: amenities || null,
        description: description || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(property, { status: 201 })
  } catch (error: any) {
    // Handle redirect errors (from auth helpers)
    if (error.message === 'NEXT_REDIRECT' || error.digest?.startsWith('NEXT_REDIRECT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 403 })
    }
    console.error('[Properties API] Error creating property:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create property' },
      { status: 500 }
    )
  }
}

