import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertCurrency, getFxRate } from '@/lib/currency'
import { BookingSource, BookingStatus, Currency, PaymentReceivedBy } from '@prisma/client'
import { differenceInDays } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        Property: true,
        Owner: true,
        Task: true,
        CheckedInBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json(booking)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    
    const body = await request.json()
    const {
      source,
      externalReservationCode,
      guestName,
      checkInDate,
      checkOutDate,
      baseAmount,
      cleaningFee,
      platformFees,
      taxes,
      currency,
      fxRateToBase: inputFxRateToBase,
      paymentReceivedBy,
      status,
    } = body
    let fxRateToBase = inputFxRateToBase

    // Get existing booking to check for changes
    const existingBooking = await prisma.booking.findUnique({
      where: { id },
      include: { Property: true },
    })

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Recalculate if dates or amounts changed
    let nights = body.nights
    let totalPayout = body.totalPayout
    let totalPayoutInBase = body.totalPayoutInBase

    if (checkInDate && checkOutDate) {
      nights = differenceInDays(new Date(checkOutDate), new Date(checkInDate))
    }

    if (baseAmount !== undefined) {
      totalPayout = (baseAmount || 0) + (cleaningFee || 0) - (platformFees || 0) - (taxes || 0)
      const currentFxRate = await getFxRate((currency || existingBooking.currency) as Currency)
      const effectiveFxRate = fxRateToBase || currentFxRate
      totalPayoutInBase = await convertCurrency(totalPayout, (currency || existingBooking.currency) as Currency)
      if (!fxRateToBase) {
        // Update fxRateToBase if not provided
        fxRateToBase = effectiveFxRate
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        source: source as BookingSource,
        externalReservationCode,
        guestName,
        checkInDate: checkInDate ? new Date(checkInDate) : undefined,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : undefined,
        nights,
        baseAmount,
        cleaningFee,
        platformFees,
        taxes,
        totalPayout,
        currency: currency as Currency,
        fxRateToBase,
        totalPayoutInBase,
        paymentReceivedBy: paymentReceivedBy ? (paymentReceivedBy as PaymentReceivedBy) : undefined,
        status: status as BookingStatus,
      },
      include: {
        Property: true,
        Owner: true,
      },
    })

    // Handle commissions payable if paymentReceivedBy or amounts changed
    const oldPaymentReceivedBy = existingBooking.paymentReceivedBy
    const newPaymentReceivedBy = paymentReceivedBy || oldPaymentReceivedBy
    const commissionRate = booking.Property.defaultCommissionRate || 0.15

    // Get or create owner wallet
    let wallet = await prisma.ownerWallet.findUnique({
      where: { ownerId: booking.ownerId },
    })

    if (!wallet) {
      wallet = await prisma.ownerWallet.create({
        data: {
          id: crypto.randomUUID(),
          ownerId: booking.ownerId,
          currentBalance: 0,
          commissionsPayable: 0,
          updatedAt: new Date(),
        },
      })
    }

    // Calculate old and new commission
    const oldGrossAmount = existingBooking.baseAmount + existingBooking.cleaningFee
    const oldCommission = oldGrossAmount * commissionRate
    const oldCommissionInBase = await convertCurrency(oldCommission, existingBooking.currency as Currency)

    const newGrossAmount = (booking.baseAmount || existingBooking.baseAmount) + (booking.cleaningFee || existingBooking.cleaningFee)
    const newCommission = newGrossAmount * commissionRate
    const newCommissionInBase = await convertCurrency(newCommission, (booking.currency || existingBooking.currency) as Currency)

    // Update commissions payable based on changes
    if (oldPaymentReceivedBy === 'OWNER' && newPaymentReceivedBy === 'COMPANY') {
      // Changed from OWNER to COMPANY: remove commission from payable
      await prisma.ownerWallet.update({
        where: { id: wallet.id },
        data: {
          commissionsPayable: {
            decrement: oldCommissionInBase,
          },
        },
      })
    } else if (oldPaymentReceivedBy === 'COMPANY' && newPaymentReceivedBy === 'OWNER') {
      // Changed from COMPANY to OWNER: add commission to payable
      await prisma.ownerWallet.update({
        where: { id: wallet.id },
        data: {
          commissionsPayable: {
            increment: newCommissionInBase,
          },
        },
      })
    } else if (oldPaymentReceivedBy === 'OWNER' && newPaymentReceivedBy === 'OWNER') {
      // Still OWNER but amounts changed: adjust commission difference
      const commissionDiff = newCommissionInBase - oldCommissionInBase
      if (commissionDiff !== 0) {
        await prisma.ownerWallet.update({
          where: { id: wallet.id },
          data: {
            commissionsPayable: {
              increment: commissionDiff,
            },
          },
        })
      }
    }

    // Send notification if booking was updated (non-blocking)
    try {
      const { sendBookingNotification } = await import('@/lib/notifications/service')
      sendBookingNotification(booking.id, 'updated', booking.ownerId).catch((err) => {
        console.error('Failed to send booking update notification:', err)
      })
    } catch (error) {
      console.error('Notification error:', error)
    }

    // Execute workflows (non-blocking)
    try {
      const { executeWorkflows } = await import('@/lib/workflows/engine')
      
      // Check if status changed
      const statusChanged = existingBooking.status !== booking.status
      
      // Execute appropriate workflow
      const trigger = statusChanged 
        ? 'BOOKING_STATUS_CHANGED' 
        : 'BOOKING_UPDATED'
      
      executeWorkflows(trigger, {
        entityType: 'booking',
        entityId: booking.id,
        entityData: booking,
        propertyId: booking.propertyId,
        ownerId: booking.ownerId,
      }).catch((err) => {
        console.error('Failed to execute workflows for booking update:', err)
      })
    } catch (error) {
      console.error('Workflow execution error:', error)
    }

    return NextResponse.json(booking)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update booking' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    
    await prisma.booking.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete booking' },
      { status: 500 }
    )
  }
}

