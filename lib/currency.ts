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
 */
async function getFxRatesFromDB(): Promise<Record<Currency, number>> {
  const now = Date.now()
  
  // Return cached rates if still valid
  if (fxRatesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return fxRatesCache
  }


  try {
    // Only fetch from API if we're on the server (not in browser)
    if (typeof window === 'undefined') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/api/settings/fx-rates`, {
        cache: 'no-store',
      })
      
      if (res.ok) {
        const rates = await res.json()
        fxRatesCache = rates as Record<Currency, number>
        cacheTimestamp = now
        return fxRatesCache
      }
    }
    
    // Fallback to default rates (for client-side or if API fails)
    return DEFAULT_FX_RATES
  } catch (error) {
    console.error('Failed to fetch FX rates:', error)
    // Return default rates on error
    return DEFAULT_FX_RATES
  }
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

