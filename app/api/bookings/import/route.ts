import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { BookingSource, BookingStatus, Currency, PaymentReceivedBy, TaskType, TaskStatus } from '@prisma/client'
import { convertCurrency } from '@/lib/currency'
import { differenceInDays, parse } from 'date-fns'

interface ParsedBooking {
  propertyId: string
  ownerId: string
  source: BookingSource
  externalReservationCode?: string
  guestName?: string
  checkInDate: Date
  checkOutDate: Date
  baseAmount: number
  cleaningFee: number
  platformFees: number
  taxes: number
  currency: Currency
  paymentReceivedBy: PaymentReceivedBy
  errors?: string[]
}

// Helper to parse CSV text
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // Detect delimiter (comma or semicolon)
  const delimiter = csvText.includes(';') ? ';' : ','
  
  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))
  
  // Parse rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
    if (values.length === headers.length) {
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      rows.push(row)
    }
  }
  
  return rows
}

// Map CSV columns to booking fields (flexible column mapping)
function mapCSVRowToBooking(
  row: Record<string, string>,
  propertyId: string,
  ownerId: string,
  defaultSource: BookingSource = BookingSource.OTHER
): ParsedBooking | null {
  const errors: string[] = []
  
  // Try to find columns (case-insensitive, flexible naming)
  const findColumn = (possibleNames: string[]): string | null => {
    for (const name of possibleNames) {
      const key = Object.keys(row).find(
        k => k.toLowerCase().trim() === name.toLowerCase().trim()
      )
      if (key && row[key]) return row[key]
    }
    return null
  }

  // Parse dates (try multiple formats)
  const parseDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null
    const formats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'yyyy/MM/dd',
      'dd-MM-yyyy',
      'MM-dd-yyyy',
    ]
    for (const format of formats) {
      try {
        return parse(dateStr.trim(), format, new Date())
      } catch {
        continue
      }
    }
    return null
  }

  // Get check-in date
  const checkInStr = findColumn([
    'check-in', 'checkin', 'check_in', 'arrival', 'start date', 'check-in date'
  ])
  const checkInDate = parseDate(checkInStr)
  if (!checkInDate) {
    errors.push('Missing or invalid check-in date')
  }

  // Get check-out date
  const checkOutStr = findColumn([
    'check-out', 'checkout', 'check_out', 'departure', 'end date', 'check-out date'
  ])
  const checkOutDate = parseDate(checkOutStr)
  if (!checkOutDate) {
    errors.push('Missing or invalid check-out date')
  }

  // Validate dates
  if (checkInDate && checkOutDate && checkInDate >= checkOutDate) {
    errors.push('Check-out date must be after check-in date')
  }

  // Get amounts
  const parseAmount = (str: string | null): number => {
    if (!str) return 0
    return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0
  }

  const baseAmount = parseAmount(findColumn([
    'amount', 'base amount', 'base_amount', 'revenue', 'payout', 'total', 'price'
  ]))
  
  const cleaningFee = parseAmount(findColumn([
    'cleaning fee', 'cleaning_fee', 'cleaning', 'cleaningfee'
  ])) || 0

  const platformFees = parseAmount(findColumn([
    'platform fee', 'platform_fee', 'service fee', 'service_fee', 'commission', 'fees'
  ])) || 0

  const taxes = parseAmount(findColumn([
    'tax', 'taxes', 'tax amount', 'tax_amount'
  ])) || 0

  // Get guest name
  const guestName = findColumn([
    'guest', 'guest name', 'guest_name', 'guestname', 'customer', 'customer name'
  ]) || undefined

  // Get reservation code
  const externalReservationCode = findColumn([
    'reservation', 'reservation code', 'reservation_code', 'booking id', 'booking_id',
    'confirmation', 'confirmation code', 'confirmation_code', 'reference', 'reference code'
  ]) || undefined

  // Detect source from reservation code or column
  let source = defaultSource
  const sourceStr = findColumn(['source', 'platform', 'channel'])
  if (sourceStr) {
    const sourceUpper = sourceStr.toUpperCase()
    if (sourceUpper.includes('AIRBNB') || sourceUpper.includes('ABNB')) {
      source = BookingSource.AIRBNB
    } else if (sourceUpper.includes('BOOKING') || sourceUpper.includes('BOOKING.COM')) {
      source = BookingSource.BOOKING_COM
    } else if (sourceUpper.includes('INSTAGRAM') || sourceUpper.includes('IG')) {
      source = BookingSource.INSTAGRAM
    } else if (sourceUpper.includes('DIRECT')) {
      source = BookingSource.DIRECT
    }
  } else if (externalReservationCode) {
    // Try to detect from reservation code format
    if (externalReservationCode.startsWith('AB') || externalReservationCode.length === 10) {
      source = BookingSource.AIRBNB
    } else if (externalReservationCode.length === 8) {
      source = BookingSource.BOOKING_COM
    }
  }

  // Get currency (default to GHS)
  const currencyStr = findColumn(['currency', 'curr', 'currency code'])
  const currency = currencyStr?.toUpperCase() === 'USD' ? Currency.USD : Currency.GHS

  // Get payment received by
  const paymentStr = findColumn(['payment received by', 'payment_received_by', 'received by'])
  const paymentReceivedBy = paymentStr?.toUpperCase().includes('OWNER')
    ? PaymentReceivedBy.OWNER
    : PaymentReceivedBy.COMPANY

  if (errors.length > 0) {
    return { ...({} as ParsedBooking), errors }
  }

  return {
    propertyId,
    ownerId,
    source,
    externalReservationCode,
    guestName,
    checkInDate: checkInDate!,
    checkOutDate: checkOutDate!,
    baseAmount,
    cleaningFee,
    platformFees,
    taxes,
    currency,
    paymentReceivedBy,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and managers can import bookings
    if (user.role !== 'MANAGER' && !['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const propertyId = formData.get('propertyId') as string | null
    const ownerId = formData.get('ownerId') as string | null
    const defaultSource = (formData.get('defaultSource') as string) || BookingSource.OTHER
    const skipDuplicates = formData.get('skipDuplicates') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!propertyId || !ownerId) {
      return NextResponse.json(
        { error: 'Property ID and Owner ID are required' },
        { status: 400 }
      )
    }

    // Verify property exists and get owner
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { Owner: true },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    if (property.ownerId !== ownerId) {
      return NextResponse.json(
        { error: 'Property does not belong to the specified owner' },
        { status: 400 }
      )
    }

    // If manager, verify they manage this property
    if (user.role === 'MANAGER' && property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only import bookings for properties you manage' },
        { status: 403 }
      )
    }

    // Read and parse CSV
    const csvText = await file.text()
    const rows = parseCSV(csvText)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      )
    }

    // Parse bookings
    const parsedBookings: (ParsedBooking | null)[] = rows.map(row =>
      mapCSVRowToBooking(row, propertyId, ownerId, defaultSource as BookingSource)
    )

    // Separate valid and invalid bookings
    const validBookings: ParsedBooking[] = []
    const invalidBookings: Array<{ row: number; errors: string[] }> = []

    parsedBookings.forEach((booking, index) => {
      if (!booking) {
        invalidBookings.push({ row: index + 2, errors: ['Failed to parse row'] })
      } else if (booking.errors && booking.errors.length > 0) {
        invalidBookings.push({ row: index + 2, errors: booking.errors })
      } else {
        validBookings.push(booking)
      }
    })

    // Check for duplicates
    const existingBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        OR: validBookings
          .filter(b => b.externalReservationCode)
          .map(b => ({
            externalReservationCode: b.externalReservationCode,
          })),
      },
    })

    const existingCodes = new Set(
      existingBookings.map(b => b.externalReservationCode).filter(Boolean)
    )

    const duplicates: ParsedBooking[] = []
    const toImport: ParsedBooking[] = []

    validBookings.forEach(booking => {
      if (booking.externalReservationCode && existingCodes.has(booking.externalReservationCode)) {
        if (!skipDuplicates) {
          duplicates.push(booking)
        }
      } else {
        toImport.push(booking)
      }
    })

    // If preview mode, return parsed data without importing
    const preview = formData.get('preview') === 'true'
    if (preview) {
      return NextResponse.json({
        preview: true,
        total: rows.length,
        valid: validBookings.length,
        invalid: invalidBookings.length,
        duplicateCount: duplicates.length,
        toImport: toImport.length,
        invalidBookings,
        duplicates: duplicates.map(b => ({
          externalReservationCode: b.externalReservationCode,
          checkInDate: b.checkInDate,
        })),
        sample: toImport.slice(0, 5).map(b => ({
          guestName: b.guestName,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          baseAmount: b.baseAmount,
          currency: b.currency,
          source: b.source,
        })),
      })
    }

    // Import bookings
    const created: any[] = []
    const failed: Array<{ booking: ParsedBooking; error: string }> = []

    for (const booking of toImport) {
      try {
        const nights = differenceInDays(booking.checkOutDate, booking.checkInDate)
        const totalPayout = booking.baseAmount + booking.cleaningFee - booking.platformFees - booking.taxes
        const totalPayoutInBase = await convertCurrency(totalPayout, booking.currency)

        const createdBooking = await prisma.booking.create({
          data: {
            id: crypto.randomUUID(),
            propertyId: booking.propertyId,
            ownerId: booking.ownerId,
            source: booking.source,
            externalReservationCode: booking.externalReservationCode,
            guestName: booking.guestName,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            nights,
            baseAmount: booking.baseAmount,
            cleaningFee: booking.cleaningFee,
            platformFees: booking.platformFees,
            taxes: booking.taxes,
            totalPayout,
            currency: booking.currency,
            fxRateToBase: 1.0,
            totalPayoutInBase,
            status: BookingStatus.UPCOMING,
            createdById: user.id,
            paymentReceivedBy: booking.paymentReceivedBy,
            updatedAt: new Date(),
          },
        })

        // Auto-create cleaning task
        await prisma.task.create({
          data: {
            id: crypto.randomUUID(),
            propertyId: booking.propertyId,
            bookingId: createdBooking.id,
            type: TaskType.CLEANING,
            title: `Cleaning for ${property.name}`,
            description: `Cleaning task for booking ${booking.externalReservationCode || createdBooking.id}`,
            scheduledAt: booking.checkOutDate,
            dueAt: booking.checkOutDate,
            status: TaskStatus.PENDING,
            updatedAt: new Date(),
          },
        })

        created.push(createdBooking)
      } catch (error: any) {
        failed.push({ booking, error: error.message || 'Failed to create booking' })
      }
    }

    return NextResponse.json({
      success: true,
      imported: created.length,
      failedCount: failed.length,
      skipped: duplicates.length,
      invalid: invalidBookings.length,
      total: rows.length,
      created: created.map(b => ({
        id: b.id,
        guestName: b.guestName,
        checkInDate: b.checkInDate,
      })),
      failed: failed.map(f => ({
        guestName: f.booking.guestName,
        checkInDate: f.booking.checkInDate,
        error: f.error,
      })),
    })
  } catch (error: any) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import CSV' },
      { status: 500 }
    )
  }
}

