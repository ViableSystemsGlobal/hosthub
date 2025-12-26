import { NextRequest, NextResponse } from 'next/server'
import { generateForecast } from '@/lib/ai/service'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')
    const ownerId = searchParams.get('ownerId')

    // Get historical data (last 12 months)
    const endDate = endOfMonth(new Date())
    const startDate = startOfMonth(subMonths(new Date(), 12))

    let bookings: any[] = []
    let currency = 'GHS' // Default currency
    if (propertyId) {
      // Get property currency
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { currency: true },
      })
      if (property) {
        currency = property.currency
      }

      bookings = await prisma.booking.findMany({
        where: {
          propertyId,
          checkInDate: {
            gte: startDate,
            lte: endDate,
          },
          status: 'COMPLETED',
        },
      })
    } else if (ownerId) {
      // Get bookings for owner's properties
      const properties = await prisma.property.findMany({
        where: { ownerId },
        select: { id: true, currency: true },
      })
      const propertyIds = properties.map((p) => p.id)

      // Use the most common currency from owner's properties, or default to GHS
      if (properties.length > 0) {
        const currencies = properties.map((p) => p.currency).filter(Boolean)
        if (currencies.length > 0) {
          // Get the most common currency
          const currencyCounts = currencies.reduce((acc: any, curr) => {
            acc[curr] = (acc[curr] || 0) + 1
            return acc
          }, {})
          currency = Object.keys(currencyCounts).reduce((a, b) =>
            currencyCounts[a] > currencyCounts[b] ? a : b
          )
        }
      }

      if (propertyIds.length > 0) {
        bookings = await prisma.booking.findMany({
          where: {
            propertyId: { in: propertyIds },
            checkInDate: {
              gte: startDate,
              lte: endDate,
            },
            status: 'COMPLETED',
          },
        })
      }
    }

    // Aggregate by month
    const monthlyData = bookings.reduce((acc: any, booking) => {
      const month = booking.checkInDate.toISOString().slice(0, 7)
      if (!acc[month]) {
        acc[month] = { revenue: 0, nights: 0 }
      }
      acc[month].revenue += booking.totalPayoutInBase
      acc[month].nights += booking.nights
      return acc
    }, {})

    const historicalData = Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
      month,
      revenue: data.revenue,
      nights: data.nights,
    }))

    // If no historical data, return a default forecast
    if (historicalData.length === 0) {
      return NextResponse.json({
        forecastMonthlyRevenue: [0, 0, 0, 0, 0, 0],
        forecastOccupancy: [0, 0, 0, 0, 0, 0],
        narrative: 'No historical data available. Please add completed bookings to generate accurate forecasts.',
        low: 0,
        expected: 0,
        high: 0,
      })
    }

    try {
      const forecast = await generateForecast(historicalData, propertyId || undefined, ownerId || undefined, currency)
      return NextResponse.json(forecast)
    } catch (forecastError: any) {
      console.error('Forecast generation error:', forecastError)
      // Return a fallback forecast if AI service fails
      return NextResponse.json({
        forecastMonthlyRevenue: [0, 0, 0, 0, 0, 0],
        forecastOccupancy: [0, 0, 0, 0, 0, 0],
        narrative: `Unable to generate AI forecast. ${forecastError.message || 'Please check AI API configuration.'}`,
        low: 0,
        expected: 0,
        high: 0,
      })
    }
  } catch (error: any) {
    console.error('Forecast API error:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate forecast',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

