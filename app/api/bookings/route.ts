import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { convertCurrency, getFxRate } from '@/lib/currency'
import { BookingSource, BookingStatus, Currency, PaymentReceivedBy, TaskType, TaskStatus } from '@prisma/client'
import { differenceInDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle redirect errors from auth helpers
    if ((user as any).error) {
      return NextResponse.json({ error: (user as any).error }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const ownerId = searchParams.get('ownerId')
    const source = searchParams.get('source')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    
    // Owners can only see their own bookings
    if (user.role === 'OWNER') {
      if (!user.ownerId) {
        return NextResponse.json({ error: 'No owner linked' }, { status: 403 })
      }
      where.ownerId = user.ownerId
    } else if (user.role === 'MANAGER') {
      // Managers can only see bookings for their assigned properties
      const assignedProperties = await prisma.property.findMany({
        where: { managerId: user.id },
        select: { id: true },
      })
      const propertyIds = assignedProperties.map(p => p.id)
      if (propertyIds.length === 0) {
        return NextResponse.json([])
      }
      where.propertyId = { in: propertyIds }
      if (propertyId && propertyIds.includes(propertyId)) {
        where.propertyId = propertyId
      }
    } else {
      if (propertyId) where.propertyId = propertyId
      if (ownerId) where.ownerId = ownerId
    }
    
    if (source) where.source = source as BookingSource
    if (status) where.status = status as BookingStatus
    if (startDate || endDate) {
      where.checkInDate = {}
      if (startDate) where.checkInDate.gte = new Date(startDate)
      if (endDate) where.checkInDate.lte = new Date(endDate)
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        Property: true,
        Owner: true,
        CheckedInBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { checkInDate: 'desc' },
      take: 100,
    })

    return NextResponse.json(bookings)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
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

    // Only admins and managers can create bookings
    if (user.role !== 'MANAGER' && !['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const body = await request.json()
    const {
      propertyId,
      source,
      externalReservationCode,
      guestName,
      checkInDate,
      checkOutDate,
      baseAmount,
      cleaningFee = 0,
      platformFees = 0,
      taxes = 0,
      currency,
      fxRateToBase,
      paymentReceivedBy = 'COMPANY',
      autoCreateCleaningTask = true,
    } = body

    // Get property to get owner and currency
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { Owner: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // If manager, verify they manage this property
    if (user.role === 'MANAGER' && property.managerId !== user.id) {
      return NextResponse.json({ error: 'You can only create bookings for properties you manage' }, { status: 403 })
    }

    // Calculate nights
    const nights = differenceInDays(new Date(checkOutDate), new Date(checkInDate))
    
    // Calculate totals
    const totalPayout = baseAmount + cleaningFee - platformFees - taxes
    const currentFxRate = await getFxRate(currency as Currency)
    const fxRate = fxRateToBase || currentFxRate
    const totalPayoutInBase = await convertCurrency(totalPayout, currency as Currency)

    // Create booking
    const bookingId = crypto.randomUUID()
    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        propertyId,
        ownerId: property.ownerId,
        source: source as BookingSource,
        externalReservationCode,
        guestName,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        nights,
        baseAmount,
        cleaningFee,
        platformFees,
        taxes,
        totalPayout,
        currency: currency as Currency,
        fxRateToBase: fxRate,
        totalPayoutInBase,
        paymentReceivedBy: paymentReceivedBy as PaymentReceivedBy,
        status: BookingStatus.UPCOMING,
        updatedAt: new Date(),
      },
      include: {
        Property: true,
        Owner: true,
      },
    })

    // If payment went directly to owner, add commission to commissionsPayable
    if (paymentReceivedBy === 'OWNER') {
      // Get or create owner wallet
      let wallet = await prisma.ownerWallet.findUnique({
        where: { ownerId: property.ownerId },
      })

      if (!wallet) {
        wallet = await prisma.ownerWallet.create({
          data: {
            id: crypto.randomUUID(),
            ownerId: property.ownerId,
            currentBalance: 0,
            commissionsPayable: 0,
            updatedAt: new Date(),
          },
        })
      }

      // Calculate commission (rate * gross revenue)
      const commissionRate = property.defaultCommissionRate || 0.15
      const grossBookingAmount = baseAmount + cleaningFee
      const commission = grossBookingAmount * commissionRate
      // Convert to GHS for consistent storage (commissionsPayable is always in GHS)
      const commissionInGHS = await convertCurrency(commission, currency as Currency, 'GHS')

      // Update wallet with new commission payable
      await prisma.ownerWallet.update({
        where: { id: wallet.id },
        data: {
          commissionsPayable: {
            increment: commissionInGHS,
          },
        },
      })
    }

    // Auto-create cleaning task if requested
    if (autoCreateCleaningTask) {
      await prisma.task.create({
        data: {
          id: crypto.randomUUID(),
          propertyId,
          bookingId: booking.id,
          type: TaskType.CLEANING,
          title: `Cleaning for ${property.name}`,
          description: `Cleaning task for booking ${externalReservationCode || booking.id}`,
          scheduledAt: new Date(checkOutDate),
          dueAt: new Date(checkOutDate),
          status: TaskStatus.PENDING,
          updatedAt: new Date(),
        },
      })
    }

    // Send notification (non-blocking)
    try {
      const { sendBookingNotification } = await import('@/lib/notifications/service')
      sendBookingNotification(booking.id, 'created', property.ownerId).catch((err) => {
        console.error('Failed to send booking creation notification:', err)
      })
    } catch (error) {
      console.error('Notification error:', error)
    }

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      executeWorkflows('BOOKING_CREATED', {
        entityType: 'booking',
        entityId: booking.id,
        entityData: booking,
        propertyId: booking.propertyId,
        ownerId: booking.ownerId,
      }).catch((err) => {
        console.error('Failed to execute workflows for booking creation:', err)
      })
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}

