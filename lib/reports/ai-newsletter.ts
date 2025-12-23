/**
 * AI-Powered Newsletter Report Generator
 * Creates Morning Brew-style narrative reports from business data
 */

import { prisma } from '@/lib/prisma'
import { generateChatCompletion, ChatMessage } from '@/lib/ai/providers'
import { formatCurrency, Currency } from '@/lib/currency'
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

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
  period: 'daily' | 'weekly' | 'monthly',
  filters?: {
    propertyIds?: string[]
    ownerIds?: string[]
  }
): Promise<NewsletterReport> {
  // Calculate date range based on period
  const now = new Date()
  let startDate: Date
  let endDate: Date = endOfDay(now)
  let periodLabel: string

  switch (period) {
    case 'daily':
      startDate = startOfDay(now)
      periodLabel = 'Today'
      break
    case 'weekly':
      startDate = startOfWeek(subWeeks(now, 1))
      endDate = endOfWeek(subWeeks(now, 1))
      periodLabel = 'Last Week'
      break
    case 'monthly':
      startDate = startOfMonth(subMonths(now, 1))
      endDate = endOfMonth(subMonths(now, 1))
      periodLabel = 'Last Month'
      break
  }

  // Collect data
  const data = await collectReportData(startDate, endDate, filters)

  // Generate AI narrative
  const narrative = await generateAINarrative(data, period, periodLabel)

  // Format metrics
  const metrics = {
    revenue: data.totalRevenue,
    bookings: data.totalBookings,
    occupancy: data.averageOccupancy,
    expenses: data.totalExpenses,
    netProfit: data.totalRevenue - data.totalExpenses,
  }

  return {
    subject: `${periodLabel} Report: ${formatCurrency(metrics.revenue, Currency.GHS)} Revenue | ${metrics.bookings} Bookings`,
    greeting: `Good morning! ☀️`,
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
  periodLabel: string
): Promise<{
  intro: string
  sections: NewsletterSection[]
  highlights: string[]
  closing: string
}> {
  const prompt = `You are writing a Morning Brew-style business newsletter for a property management company. 
Write in a conversational, engaging tone with personality. Use emojis sparingly but effectively. 
Make it informative but not dry. Include insights, trends, and actionable takeaways.

Here's the data for ${periodLabel}:
- Total Revenue: ${formatCurrency(data.totalRevenue, Currency.GHS)}
- Total Bookings: ${data.totalBookings}
- Total Nights: ${data.totalNights}
- Average Occupancy: ${data.averageOccupancy.toFixed(1)}%
- Total Expenses: ${formatCurrency(data.totalExpenses, Currency.GHS)}
- Net Profit: ${formatCurrency(data.totalRevenue - data.totalExpenses, Currency.GHS)}
- Open Issues: ${data.openIssues}
- Top Properties: ${JSON.stringify(data.topProperties.slice(0, 3))}

Write a newsletter with:
1. A brief, engaging intro (2-3 sentences) that hooks the reader
2. 3-4 sections covering:
   - Revenue & Performance (with key metrics)
   - Top Performers (highlight top properties)
   - Operations Update (issues, expenses, what's working)
   - Quick Insights (trends, opportunities, warnings)
3. 3-5 bullet point highlights (key takeaways)
4. A friendly closing (1-2 sentences)

Format your response as JSON:
{
  "intro": "string",
  "sections": [
    {
      "title": "string",
      "content": "string (2-3 paragraphs, engaging)",
      "emoji": "optional emoji"
    }
  ],
  "highlights": ["string", "string"],
  "closing": "string"
}

Make it feel like a real newsletter - conversational, insightful, and valuable.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a skilled business newsletter writer in the style of Morning Brew. Write engaging, conversational content that makes business data interesting and actionable.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const responseText = await generateChatCompletion(messages, {
    responseFormat: { type: 'json_object' },
    temperature: 0.8, // Higher temperature for more creative writing
  })

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
    return {
      intro: `Here's your ${periodLabel.toLowerCase()} report.`,
      sections: [
        {
          title: 'Revenue & Performance',
          content: `You generated ${formatCurrency(data.totalRevenue, Currency.GHS)} in revenue from ${data.totalBookings} bookings.`,
        },
        {
          title: 'Top Performers',
          content: `Your top properties are performing well.`,
        },
      ],
      highlights: [
        `${data.totalBookings} bookings completed`,
        `${formatCurrency(data.totalRevenue, Currency.GHS)} in revenue`,
        `${data.averageOccupancy.toFixed(1)}% average occupancy`,
      ],
      closing: 'Keep up the great work!',
    }
  }
}

