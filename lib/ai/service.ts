import { prisma } from '../prisma'
import { addHours } from 'date-fns'
import { generateChatCompletion, ChatMessage } from './providers'
import { randomUUID } from 'crypto'

export interface AIInsight {
  title: string
  summary: string
  keyPoints: string[]
  suggestions: string[]
  riskFlags?: string[]
}

export interface AIForecast {
  forecastMonthlyRevenue: number[]
  forecastOccupancy: number[]
  narrative: string
  low: number
  expected: number
  high: number
}

export interface AIMarketingStrategy {
  pricing: string[]
  promotions: string[]
  listing: string[]
  content: string[]
  campaigns: string[]
}

export async function generateInsight(
  pageType: string,
  context: any,
  ownerId?: string,
  propertyId?: string,
  currency: string = 'GHS'
): Promise<AIInsight> {
  // Check cache
  const period = new Date().toISOString().slice(0, 7) // YYYY-MM
  
  // Build where clause that handles null values properly
  const whereClause: any = {
    pageType,
    period,
  }
  
  if (ownerId) {
    whereClause.ownerId = ownerId
  } else {
    whereClause.ownerId = null
  }
  
  if (propertyId) {
    whereClause.propertyId = propertyId
  } else {
    whereClause.propertyId = null
  }

  let cached = await prisma.aiInsightCache.findFirst({
    where: whereClause,
  })

  // Check if cached insight is valid and uses correct currency
  if (cached && cached.expiresAt > new Date()) {
    const cachedInsight = cached.data as unknown as AIInsight
    // Check if cached insight contains $ symbol (old format) - if so, skip cache and regenerate
    const insightText = JSON.stringify(cachedInsight)
    if (!insightText.includes('$')) {
      return cachedInsight
    }
    // If it contains $, try to delete the cache (ignore if it fails) and regenerate
    try {
      await prisma.aiInsightCache.delete({
        where: { id: cached.id },
      })
    } catch (error) {
      // Ignore delete errors - cache might have been deleted already
      console.log('Cache deletion skipped (may not exist):', error)
    }
    // Clear cached reference since we deleted it or tried to
    cached = null
  }

  // Generate prompt based on page type
  const prompt = buildInsightPrompt(pageType, context, currency)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        `You are an analytical assistant for a property management platform. Provide insights in JSON format with title, summary, keyPoints (array), suggestions (array), and optional riskFlags (array).

CRITICAL CURRENCY RULE: You MUST NEVER use the dollar sign ($) in your response. All currency amounts MUST use ${currency} symbol. 
- CORRECT: "${currency}48,745", "${currency}7,311.75", "${currency}900"
- WRONG: "$48,745", "$7,311.75", "$900"
- Every single monetary value in your entire response must use ${currency}, not $.
- Check your response carefully before returning it to ensure no $ symbols appear anywhere.`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const responseText = await generateChatCompletion(messages, {
    responseFormat: { type: 'json_object' },
    temperature: 0.7,
  })

  const insight = JSON.parse(responseText || '{}') as AIInsight

  // Cache the result - only update if cached still exists and wasn't deleted
  if (cached) {
    // Try to update existing cache, but if it fails (was deleted), create new one
    try {
      await prisma.aiInsightCache.update({
        where: { id: cached.id },
        data: {
          data: insight as any,
          expiresAt: addHours(new Date(), 1),
        },
      })
    } catch (error) {
      // If update fails (record doesn't exist), create new entry
      await prisma.aiInsightCache.create({
        data: {
          id: randomUUID(),
          pageType,
          ownerId: ownerId || null,
          propertyId: propertyId || null,
          period,
          data: insight as any,
          expiresAt: addHours(new Date(), 1),
        },
      })
    }
  } else {
    // Create new cache entry
    await prisma.aiInsightCache.create({
      data: {
        id: randomUUID(),
        pageType,
        ownerId: ownerId || null,
        propertyId: propertyId || null,
        period,
        data: insight as any,
        expiresAt: addHours(new Date(), 1),
      },
    })
  }

  return insight
}

export async function generateForecast(
  historicalData: any,
  propertyId?: string,
  ownerId?: string,
  currency: string = 'GHS'
): Promise<AIForecast> {
  const prompt = buildForecastPrompt(historicalData, currency)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a forecasting assistant for property management. You MUST respond with valid JSON containing these exact fields:
{
  "forecastMonthlyRevenue": [number, number, number, number, number, number],
  "forecastOccupancy": [number, number, number, number, number, number],
  "narrative": "string with your analysis",
  "low": number (total 6-month revenue - conservative estimate),
  "expected": number (total 6-month revenue - expected estimate),
  "high": number (total 6-month revenue - optimistic estimate)
}

IMPORTANT: When writing the narrative, use ${currency} (not $) for currency. For example, write "${currency}5,000" instead of "$5,000".

The forecastMonthlyRevenue array must contain 6 numeric values representing predicted revenue for each of the next 6 months.
The forecastOccupancy array must contain 6 numeric values (0-100) representing predicted occupancy percentage for each month.
The low, expected, and high values should be the total 6-month revenue in different scenarios.`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const responseText = await generateChatCompletion(messages, {
    responseFormat: { type: 'json_object' },
    temperature: 0.7,
  })

  try {
    const parsed = JSON.parse(responseText || '{}')
    
    // Validate and normalize the response
    const forecast: AIForecast = {
      forecastMonthlyRevenue: Array.isArray(parsed.forecastMonthlyRevenue) 
        ? parsed.forecastMonthlyRevenue.map((v: any) => typeof v === 'number' ? v : parseFloat(v) || 0)
        : [0, 0, 0, 0, 0, 0],
      forecastOccupancy: Array.isArray(parsed.forecastOccupancy)
        ? parsed.forecastOccupancy.map((v: any) => typeof v === 'number' ? v : parseFloat(v) || 0)
        : [0, 0, 0, 0, 0, 0],
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
      low: typeof parsed.low === 'number' ? parsed.low : parseFloat(parsed.low) || 0,
      expected: typeof parsed.expected === 'number' ? parsed.expected : parseFloat(parsed.expected) || 0,
      high: typeof parsed.high === 'number' ? parsed.high : parseFloat(parsed.high) || 0,
    }

    // If expected is 0 but we have monthly revenue, calculate it
    if (forecast.expected === 0 && forecast.forecastMonthlyRevenue.some((v: number) => v > 0)) {
      forecast.expected = forecast.forecastMonthlyRevenue.reduce((sum: number, v: number) => sum + v, 0)
      forecast.low = forecast.expected * 0.8
      forecast.high = forecast.expected * 1.2
    }

    return forecast
  } catch (error: any) {
    console.error('Failed to parse AI forecast response:', responseText)
    throw new Error('AI returned an invalid response format. Please try again.')
  }
}

export async function generateMarketingStrategy(
  propertyData: any,
  performanceData: any
): Promise<AIMarketingStrategy> {
  const prompt = buildMarketingPrompt(propertyData, performanceData)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a marketing assistant for property management. You MUST respond with valid JSON containing these exact fields:
{
  "pricing": ["string array of pricing recommendations"],
  "promotions": ["string array of promotion ideas"],
  "listing": ["string array of listing improvement tips"],
  "content": ["string array of content marketing ideas"],
  "campaigns": ["string array of marketing campaign ideas"]
}

Each array should contain 3-5 actionable recommendations as strings.`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const responseText = await generateChatCompletion(messages, {
    responseFormat: { type: 'json_object' },
    temperature: 0.8,
  })

  try {
    const parsed = JSON.parse(responseText || '{}')
    
    // Validate and normalize the response
    const strategy: AIMarketingStrategy = {
      pricing: Array.isArray(parsed.pricing) ? parsed.pricing : [],
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [],
      listing: Array.isArray(parsed.listing) ? parsed.listing : [],
      content: Array.isArray(parsed.content) ? parsed.content : [],
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    }

    return strategy
  } catch (error: any) {
    console.error('Failed to parse AI marketing response:', responseText)
    throw new Error('AI returned an invalid response format. Please try again.')
  }
}

function buildInsightPrompt(pageType: string, context: any, currency: string = 'GHS'): string {
  const currencyNote = `CRITICAL: All currency amounts in the data are displayed in ${currency}. You MUST use ${currency} symbol for ALL monetary values in your response. NEVER use $ symbol. Examples: "${currency}48,745" (correct), "$48,745" (WRONG).`
  
  switch (pageType) {
    case 'admin_dashboard':
      return `Analyze this admin dashboard data: ${JSON.stringify(context)}. Provide insights about overall performance, top properties, and recommendations. 

${currencyNote}

Remember: Use ${currency} for ALL currency amounts. Do NOT use $ anywhere in your response.`
    case 'owner_dashboard':
      return `Analyze this owner dashboard data: ${JSON.stringify(context)}. Provide insights about the owner's portfolio performance and recommendations. 

${currencyNote}

Remember: Use ${currency} for ALL currency amounts. Do NOT use $ anywhere in your response.`
    case 'property_page':
      return `Analyze this property data: ${JSON.stringify(context)}. Provide insights about property performance, trends, and recommendations. 

${currencyNote}

Remember: Use ${currency} for ALL currency amounts. Do NOT use $ anywhere in your response.`
    default:
      return `Analyze this data: ${JSON.stringify(context)}. Provide insights and recommendations. 

${currencyNote}

Remember: Use ${currency} for ALL currency amounts. Do NOT use $ anywhere in your response.`
  }
}

function buildForecastPrompt(historicalData: any, currency: string = 'GHS'): string {
  return `Based on this historical property data: ${JSON.stringify(historicalData)}, provide revenue and occupancy forecasts for the next 6 months. Consider seasonality and trends.

IMPORTANT: All revenue amounts in your narrative should use ${currency} currency symbol (not $). For example, write "${currency}5,000" instead of "$5,000".`
}

function buildMarketingPrompt(propertyData: any, performanceData: any): string {
  return `For this property: ${JSON.stringify(propertyData)} with performance: ${JSON.stringify(performanceData)}, provide marketing strategies including pricing, promotions, listing improvements, content ideas, and campaign suggestions.`
}

