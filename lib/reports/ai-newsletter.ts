/**
 * AI-Powered Newsletter Report Generator
 * Creates Morning Brew-style narrative reports from business data
 */

import { prisma } from '@/lib/prisma'
import { generateChatCompletion, ChatMessage } from '@/lib/ai/providers'
import { formatCurrency, Currency, convertCurrency, getFxRate } from '@/lib/currency'
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

/**
 * Format currency showing both USD and GHS with exchange rate
 */
async function formatDualCurrency(amountUSD: number): Promise<string> {
  const fxRate = await getFxRate(Currency.USD, Currency.GHS)
  const amountGHS = amountUSD * fxRate
  return `$${amountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GHS ${amountGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at ${fxRate.toFixed(4)} rate)`
}

export interface NewsletterReport {
  subject: string
  greeting: string
  intro: string
  sections: NewsletterSection[]
  highlights: string[]
  closing: string
  metrics: {
    revenue: number
    bookings: number
    occupancy: number
    expenses: number
    netProfit: number
  }
}

export interface NewsletterSection {
  title: string
  content: string
  emoji?: string
  metrics?: Record<string, any>
}

/**
 * Generate AI-powered newsletter report
 */
export async function generateNewsletterReport(
  period: 'daily' | 'weekly' | 'monthly' | 'yesterday' | 'last-week' | 'last-month' | 'current-year',
  filters?: {
    propertyIds?: string[]
    ownerIds?: string[]
  },
  ownerName?: string
): Promise<NewsletterReport> {
  // Calculate date range based on period
  const now = new Date()
  let startDate: Date
  let endDate: Date = endOfDay(now)
  let periodLabel: string

  switch (period) {
    case 'daily':
    case 'yesterday':
      if (period === 'yesterday') {
        const yesterday = subDays(now, 1)
        startDate = startOfDay(yesterday)
        endDate = endOfDay(yesterday)
        periodLabel = 'Yesterday'
      } else {
        startDate = startOfDay(now)
        periodLabel = 'Today'
      }
      break
    case 'weekly':
    case 'last-week':
      startDate = startOfWeek(subWeeks(now, 1))
      endDate = endOfWeek(subWeeks(now, 1))
      periodLabel = 'Last Week'
      break
    case 'monthly':
    case 'last-month':
      startDate = startOfMonth(subMonths(now, 1))
      endDate = endOfMonth(subMonths(now, 1))
      periodLabel = 'Last Month'
      break
    case 'current-year':
      startDate = startOfYear(now)
      endDate = endOfDay(now)
      periodLabel = 'Current Year'
      break
  }

  // Collect data
  const data = await collectReportData(startDate, endDate, filters)

  // Generate AI narrative
  const narrative = await generateAINarrative(data, period, periodLabel, ownerName)

  // Format metrics
  const metrics = {
    revenue: data.totalRevenue,
    bookings: data.totalBookings,
    occupancy: data.averageOccupancy,
    expenses: data.totalExpenses,
    netProfit: data.totalRevenue - data.totalExpenses,
  }

  // Personalized greeting
  const greeting = ownerName 
    ? `Dear ${ownerName},`
    : `Good morning! ☀️`

  return {
    subject: `${periodLabel} Report: ${formatCurrency(metrics.revenue, Currency.GHS)} Revenue | ${metrics.bookings} Bookings`,
    greeting,
    intro: narrative.intro,
    sections: narrative.sections,
    highlights: narrative.highlights,
    closing: narrative.closing,
    metrics,
  }
}

/**
 * Collect data for the report
 */
async function collectReportData(
  startDate: Date,
  endDate: Date,
  filters?: {
    propertyIds?: string[]
    ownerIds?: string[]
  }
) {
  const where: any = {
    checkInDate: {
      gte: startDate,
      lte: endDate,
    },
    status: 'COMPLETED',
  }

  if (filters?.propertyIds && filters.propertyIds.length > 0) {
    where.propertyId = { in: filters.propertyIds }
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    where.ownerId = { in: filters.ownerIds }
  }

  // Get bookings
  const bookings = await prisma.booking.findMany({
    where,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
      Owner: {
        select: {
          name: true,
        },
      },
    },
  })

  // Get expenses
  const expenseWhere: any = {
    date: {
      gte: startDate,
      lte: endDate,
    },
  }

  if (filters?.propertyIds && filters.propertyIds.length > 0) {
    expenseWhere.propertyId = { in: filters.propertyIds }
  }

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
    },
  })

  // Get issues
  const issues = await prisma.issue.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(filters?.propertyIds && filters.propertyIds.length > 0
        ? { propertyId: { in: filters.propertyIds } }
        : {}),
    },
    include: {
      Property: {
        select: {
          name: true,
          nickname: true,
        },
      },
    },
  })

  // Calculate metrics
  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPayoutInBase, 0)
  const totalBookings = bookings.length
  const totalNights = bookings.reduce((sum, b) => sum + b.nights, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Top properties by revenue
  const propertyRevenue: Record<string, { revenue: number; bookings: number; name: string }> = {}
  bookings.forEach((booking) => {
    const propId = booking.propertyId
    const propName = booking.Property?.nickname || booking.Property?.name || 'Unknown'
    if (!propertyRevenue[propId]) {
      propertyRevenue[propId] = { revenue: 0, bookings: 0, name: propName }
    }
    propertyRevenue[propId].revenue += booking.totalPayoutInBase
    propertyRevenue[propId].bookings += 1
  })

  const topProperties = Object.entries(propertyRevenue)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Calculate average occupancy (simplified)
  const totalProperties = await prisma.property.count({
    where: filters?.propertyIds && filters.propertyIds.length > 0
      ? { id: { in: filters.propertyIds } }
      : {},
  })

  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const averageOccupancy = totalProperties > 0 && daysInPeriod > 0
    ? (totalNights / (totalProperties * daysInPeriod)) * 100
    : 0

  return {
    totalRevenue,
    totalBookings,
    totalNights,
    totalExpenses,
    averageOccupancy: Math.min(100, averageOccupancy),
    topProperties,
    openIssues: issues.filter((i) => i.status !== 'RESOLVED').length,
    totalIssues: issues.length,
    bookings,
    expenses,
  }
}

/**
 * Generate AI narrative from data
 */
async function generateAINarrative(
  data: any,
  period: 'daily' | 'weekly' | 'monthly',
  periodLabel: string,
  ownerName?: string
): Promise<{
  intro: string
  sections: NewsletterSection[]
  highlights: string[]
  closing: string
}> {
  // Convert revenue to USD for display (data is in GHS)
  const revenueUSD = await convertCurrency(data.totalRevenue, Currency.GHS, Currency.USD)
  const expensesUSD = await convertCurrency(data.totalExpenses, Currency.GHS, Currency.USD)
  const netProfitUSD = await convertCurrency(data.totalRevenue - data.totalExpenses, Currency.GHS, Currency.USD)
  const fxRate = await getFxRate(Currency.USD, Currency.GHS)

  const revenueFormatted = await formatDualCurrency(revenueUSD)
  const expensesFormatted = await formatDualCurrency(expensesUSD)
  const profitFormatted = await formatDualCurrency(netProfitUSD)

  const ownerContext = ownerName 
    ? `This report is specifically for ${ownerName}, focusing on their properties only. Address them directly (e.g., "Your properties", "Your revenue").`
    : `This is a company-wide report covering all properties.`

  const prompt = `You are writing a formal business report ${ownerName ? `specifically for ${ownerName}` : 'for a property management company'}. 
Write in a professional, formal tone suitable for business stakeholders. Be clear, concise, and data-driven.
Avoid casual language and excessive emojis. Focus on facts, analysis, and actionable insights.
${ownerContext}

Here's the data for ${periodLabel}:
- Total Revenue: ${revenueFormatted}
- Total Bookings: ${data.totalBookings}
- Total Nights: ${data.totalNights}
- Average Occupancy: ${data.averageOccupancy.toFixed(1)}%
- Total Expenses: ${expensesFormatted}
- Net Profit: ${profitFormatted}
- Open Issues: ${data.openIssues}
- Top Properties: ${JSON.stringify(data.topProperties.slice(0, 3))}

Write a formal business report with:
1. A professional introduction (2-3 sentences) summarizing the period's performance
2. 3-4 formal sections covering:
   - Revenue & Performance Analysis (with key metrics and trends)
   - Top Performing Properties (data-driven analysis)
   - Operational Overview (issues, expenses, operational efficiency)
   - Strategic Insights (trends, opportunities, recommendations)
3. 3-5 key highlights (executive summary points)
4. A professional closing (1-2 sentences)

IMPORTANT: When mentioning currency amounts, always use the format: $XX.XX (GHS XX.XX at X.XXXX rate)
Example: "Revenue reached $5,000.00 (GHS 62,500.00 at 12.5000 rate)"

Format your response as JSON:
{
  "intro": "string",
  "sections": [
    {
      "title": "string",
      "content": "string (2-3 paragraphs, formal and professional)",
      "emoji": "optional emoji (use sparingly)"
    }
  ],
  "highlights": ["string", "string"],
  "closing": "string"
}

Maintain a formal, professional tone throughout.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a professional business analyst writing formal reports for property management stakeholders. Write clear, data-driven, professional content suitable for executive review.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  let responseText: string
  try {
    responseText = await generateChatCompletion(messages, {
      responseFormat: { type: 'json_object' },
      temperature: 0.8, // Higher temperature for more creative writing
    })
  } catch (error: any) {
    console.error('Failed to generate AI completion:', error)
    // If AI fails, return a fallback report
    const fallbackIntro = ownerName 
      ? `${ownerName}, here's your ${periodLabel.toLowerCase()} report.`
      : `Here's your ${periodLabel.toLowerCase()} report.`
    
    return {
      intro: fallbackIntro,
      sections: [
        {
          title: 'Revenue & Performance',
          content: `${ownerName ? 'Your properties' : 'The company'} generated ${formatCurrency(data.totalRevenue, Currency.GHS)} in revenue from ${data.totalBookings} bookings.`,
        },
        {
          title: 'Top Performers',
          content: `${ownerName ? 'Your top properties' : 'The top properties'} are performing well.`,
        },
      ],
      highlights: [
        `${data.totalBookings} bookings completed`,
        `${formatCurrency(data.totalRevenue, Currency.GHS)} in revenue`,
        `${data.averageOccupancy.toFixed(1)}% average occupancy`,
      ],
      closing: ownerName ? 'Thank you for your continued partnership.' : 'Keep up the great work!',
    }
  }

  try {
    const parsed = JSON.parse(responseText || '{}')
    return {
      intro: parsed.intro || `Here's what happened ${periodLabel.toLowerCase()}.`,
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      closing: parsed.closing || 'Keep up the great work! 🚀',
    }
  } catch (error: any) {
    console.error('Failed to parse AI newsletter response:', error)
    // Fallback to a simple report
    const fallbackIntro = ownerName 
      ? `${ownerName}, here's your ${periodLabel.toLowerCase()} report.`
      : `Here's your ${periodLabel.toLowerCase()} report.`
    
    return {
      intro: fallbackIntro,
      sections: [
        {
          title: 'Revenue & Performance',
          content: `${ownerName ? 'Your properties' : 'The company'} generated ${formatCurrency(data.totalRevenue, Currency.GHS)} in revenue from ${data.totalBookings} bookings.`,
        },
        {
          title: 'Top Performers',
          content: `${ownerName ? 'Your top properties' : 'The top properties'} are performing well.`,
        },
      ],
      highlights: [
        `${data.totalBookings} bookings completed`,
        `${formatCurrency(data.totalRevenue, Currency.GHS)} in revenue`,
        `${data.averageOccupancy.toFixed(1)}% average occupancy`,
      ],
      closing: ownerName ? 'Thank you for your continued partnership.' : 'Keep up the great work!',
    }
  }
}

