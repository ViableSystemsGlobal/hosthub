import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { BookingStatus } from '@prisma/client'
import { format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.status || 401 }
    )
  }

  try {
    const body = await request.json()
    const { ids, action, data } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No booking IDs provided' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'No action specified' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'updateStatus':
        if (!data?.status) {
          return NextResponse.json(
            { error: 'Status is required' },
            { status: 400 }
          )
        }

        const updated = await prisma.booking.updateMany({
          where: {
            id: { in: ids },
          },
          data: {
            status: data.status as BookingStatus,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: `Updated ${updated.count} booking(s)`,
          count: updated.count,
        })

      case 'delete':
        const deleted = await prisma.booking.deleteMany({
          where: {
            id: { in: ids },
          },
        })

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted.count} booking(s)`,
          count: deleted.count,
        })

      case 'sendNotifications':
        const bookingsForNotification = await prisma.booking.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            Property: true,
            Owner: true,
          },
        })

        const { sendBookingNotification } = await import('@/lib/notifications/service')

        let successCount = 0
        let failCount = 0

        for (const booking of bookingsForNotification) {
          try {
            await sendBookingNotification(booking.id, 'reminder', booking.ownerId)
            successCount++
          } catch (error) {
            console.error(`Failed to send notification for booking ${booking.id}:`, error)
            failCount++
          }
        }

        return NextResponse.json({
          success: true,
          message: `Sent notifications for ${successCount} booking(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
          successCount,
          failCount,
        })

      case 'export':
        const bookings = await prisma.booking.findMany({
          where: {
            id: { in: ids },
          },
          include: {
            Property: {
              select: { name: true },
            },
            Owner: {
              select: { name: true },
            },
          },
          orderBy: {
            checkInDate: 'asc',
          },
        })

        // Generate CSV
        const headers = [
          'ID',
          'Property',
          'Owner',
          'Guest Name',
          'Source',
          'Check-in Date',
          'Check-out Date',
          'Nights',
          'Base Amount',
          'Cleaning Fee',
          'Platform Fees',
          'Taxes',
          'Total Payout',
          'Currency',
          'Status',
        ]

        const rows = bookings.map((booking) => [
          booking.id,
          booking.Property.name,
          booking.Owner.name,
          booking.guestName || '',
          booking.source,
          format(new Date(booking.checkInDate), 'yyyy-MM-dd'),
          format(new Date(booking.checkOutDate), 'yyyy-MM-dd'),
          booking.nights.toString(),
          (booking as any).baseAmount?.toString() || '0',
          (booking as any).cleaningFee?.toString() || '0',
          (booking as any).platformFees?.toString() || '0',
          (booking as any).taxes?.toString() || '0',
          booking.totalPayout.toString(),
          booking.currency,
          booking.status,
        ])

        const csv = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n')

        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="bookings-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
          },
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}

