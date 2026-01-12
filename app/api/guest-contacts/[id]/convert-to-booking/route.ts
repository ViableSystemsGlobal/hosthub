import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { GuestContactStatus } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins, managers, and operations can convert guest contacts to bookings
    if (!['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Get guest contact
    const guestContact = await prisma.guestContact.findUnique({
      where: { id },
      include: {
        Property: true,
      },
    })

    if (!guestContact) {
      return NextResponse.json({ error: 'Guest contact not found' }, { status: 404 })
    }

    // Managers can only convert contacts for their assigned properties
    if (user.role === 'MANAGER' && guestContact.propertyId) {
      if (guestContact.Property?.managerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Extract booking data from body
    const {
      propertyId,
      source,
      externalReservationCode,
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

    if (!propertyId || !checkInDate || !checkOutDate || !baseAmount || !currency) {
      return NextResponse.json(
        { error: 'Missing required booking fields' },
        { status: 400 }
      )
    }

    // Verify property exists and user has access
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { Owner: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (user.role === 'MANAGER' && property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only create bookings for properties you manage' },
        { status: 403 }
      )
    }

    // Import booking creation logic
    const { differenceInDays } = await import('date-fns')
    const { convertCurrency, getFxRate } = await import('@/lib/currency')
    const { BookingSource, BookingStatus, Currency, PaymentReceivedBy, TaskType, TaskStatus } = await import('@prisma/client')

    // Calculate nights
    const nights = differenceInDays(new Date(checkOutDate), new Date(checkInDate))

    // Calculate totals
    const totalPayout = baseAmount + cleaningFee - platformFees - taxes
    const currentFxRate = await getFxRate(currency as Currency)
    const fxRate = fxRateToBase || currentFxRate
    const totalPayoutInBase = await convertCurrency(totalPayout, currency as Currency)

    // Create booking with guest contact linked
    const bookingId = crypto.randomUUID()
    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        propertyId,
        ownerId: property.ownerId,
        source: (source || guestContact.source || 'DIRECT') as BookingSource,
        externalReservationCode,
        guestName: guestContact.name,
        guestEmail: guestContact.email,
        guestPhoneNumber: guestContact.phoneNumber,
        guestContactId: guestContact.id,
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

    // Update guest contact status to CONVERTED
    await prisma.guestContact.update({
      where: { id },
      data: {
        status: GuestContactStatus.CONVERTED,
        updatedAt: new Date(),
      },
    })

    // Handle payment received by owner (commission tracking)
    if (paymentReceivedBy === 'OWNER') {
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

      const commissionRate = property.defaultCommissionRate || 0.15
      const grossBookingAmount = baseAmount + cleaningFee
      const commission = grossBookingAmount * commissionRate
      const commissionInGHS = await convertCurrency(commission, currency as Currency, 'GHS')

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

    // Send notifications (non-blocking)
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
    console.error('Failed to convert guest contact to booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to convert guest contact to booking' },
      { status: 500 }
    )
  }
}
