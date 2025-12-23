import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { Currency } from '@prisma/client'

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

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        Owner: true,
        User: true, // manager relation
        Booking: {
          take: 10,
          orderBy: { checkInDate: 'desc' },
        },
        Expense: {
          take: 10,
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Owners can only see their own properties
    if (user.role === 'OWNER' && property.ownerId !== user.ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(property)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch property' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAdmin(request)
    
    const body = await request.json()
    const {
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

    // Build update data object, only including fields that are provided
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (managerId !== undefined) updateData.managerId = managerId || null
    if (name !== undefined) updateData.name = name
    if (nickname !== undefined) updateData.nickname = nickname || null
    if (address !== undefined) updateData.address = address || null
    if (city !== undefined) updateData.city = city || null
    if (country !== undefined) updateData.country = country || null
    if (currency !== undefined) updateData.currency = currency
    if (airbnbListingId !== undefined) updateData.airbnbListingId = airbnbListingId || null
    if (airbnbUrl !== undefined) updateData.airbnbUrl = airbnbUrl || null
    if (bookingComId !== undefined) updateData.bookingComId = bookingComId || null
    if (instagramHandle !== undefined) updateData.instagramHandle = instagramHandle || null
    if (defaultCommissionRate !== undefined) updateData.defaultCommissionRate = defaultCommissionRate
    if (cleaningFeeRules !== undefined) updateData.cleaningFeeRules = cleaningFeeRules || null
    if (status !== undefined) updateData.status = status
    if (photos !== undefined) updateData.photos = photos || []
    if (bedrooms !== undefined) updateData.bedrooms = bedrooms ? parseInt(String(bedrooms)) : null
    if (bathrooms !== undefined) updateData.bathrooms = bathrooms ? parseFloat(String(bathrooms)) : null
    if (maxGuests !== undefined) updateData.maxGuests = maxGuests ? parseInt(String(maxGuests)) : null
    if (amenities !== undefined) updateData.amenities = amenities || null
    if (description !== undefined) updateData.description = description || null

    const property = await prisma.property.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(property)
  } catch (error: any) {
    console.error('[Properties API] Error updating property:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update property' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await requireAdmin(request)
    
    await prisma.property.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete property' },
      { status: 500 }
    )
  }
}

