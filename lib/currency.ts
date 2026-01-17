import { Currency } from '@prisma/client'

// Base currency is USD
const BASE_CURRENCY: Currency = 'USD'

// Default FX rates (fallback if not set in database)
const DEFAULT_FX_RATES: Record<Currency, number> = {
  USD: 1.0,
  GHS: 0.08,
}

// Cache for FX rates (refreshed on each request)
let fxRatesCache: Record<Currency, number> | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Get FX rates from database, with caching
 * On server-side, queries database directly. On client-side, uses defaults.
 */
async function getFxRatesFromDB(): Promise<Record<Currency, number>> {
  const now = Date.now()
  
  // Return cached rates if still valid
  if (fxRatesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return fxRatesCache
  }

  // On server-side, query database directly
  if (typeof window === 'undefined') {
    try {
      // Dynamic import to avoid circular dependencies
      const { prisma } = await import('@/lib/prisma')
      
      const settings = await prisma.setting.findMany({
        where: {
          key: {
            in: ['FX_RATE_GHS', 'FX_RATE_USD'],
          },
        },
      })

      const rates: Record<Currency, number> = {
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

      fxRatesCache = rates
      cacheTimestamp = now
      return rates
    } catch (error) {
      console.error('Failed to fetch FX rates from database:', error)
      // Return default rates on error
      return DEFAULT_FX_RATES
    }
  }
  
  // Fallback to default rates (for client-side)
  return DEFAULT_FX_RATES
}

/**
 * Clear FX rates cache (call after updating rates in settings)
 */
export function clearFxRatesCache(): void {
  fxRatesCache = null
  cacheTimestamp = 0
}

export async function getFxRate(from: Currency, to: Currency = BASE_CURRENCY): Promise<number> {
  if (from === to) return 1.0
  
  const rates = await getFxRatesFromDB()
  
  if (to === BASE_CURRENCY) {
    return rates[from]
  }
  if (from === BASE_CURRENCY) {
    return 1 / rates[to]
  }
  // Convert from -> base -> to
  return rates[from] / rates[to]
}

export async function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency = BASE_CURRENCY
): Promise<number> {
  if (from === to) return amount
  const rate = await getFxRate(from, to)
  return amount * rate
}

export function formatCurrency(amount: number, currency: Currency): string {
  // Handle NaN, null, undefined, or invalid numbers
  if (amount === null || amount === undefined || isNaN(amount) || !isFinite(amount)) {
    amount = 0
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'GHS' ? 'GHS' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(amount)
}

export { BASE_CURRENCY, Currency }

