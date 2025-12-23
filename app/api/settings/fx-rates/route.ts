import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/fx-rates
 * Fetch current FX rates from database
 */
export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['FX_RATE_GHS', 'FX_RATE_USD'],
        },
      },
    })

    const rates: Record<string, number> = {
      USD: 1.0,
      GHS: 0.08, // Default
    }

    settings.forEach((setting) => {
      if (setting.key === 'FX_RATE_GHS') {
        const rate = parseFloat(setting.value)
        if (!isNaN(rate) && rate > 0) {
          rates.GHS = rate
        }
      } else if (setting.key === 'FX_RATE_USD') {
        const rate = parseFloat(setting.value)
        if (!isNaN(rate) && rate > 0) {
          rates.USD = rate
        }
      }
    })

    return NextResponse.json(rates)
  } catch (error: any) {
    console.error('Failed to fetch FX rates:', error)
    // Return default rates on error
    return NextResponse.json({
      USD: 1.0,
      GHS: 0.08,
    })
  }
}

