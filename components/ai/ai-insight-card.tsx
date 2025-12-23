'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Loader2 } from 'lucide-react'

interface AIInsight {
  title: string
  summary: string
  keyPoints: string[]
  suggestions: string[]
  riskFlags?: string[]
}

interface AIInsightCardProps {
  pageType: string
  context: any
  ownerId?: string
  propertyId?: string
}

export function AIInsightCard({
  pageType,
  context,
  ownerId,
  propertyId,
}: AIInsightCardProps) {
  const [insight, setInsight] = useState<AIInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInsight()
  }, [pageType, JSON.stringify(context)])

  const fetchInsight = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pageType,
          context,
          ownerId,
          propertyId,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate insights' }))
        throw new Error(errorData.error || `Failed to generate insights: ${res.statusText}`)
      }

      const data = await res.json()
      setInsight(data)
    } catch (err: any) {
      console.error('AI Insights Error:', err)
      setError(err.message || 'Failed to generate insights')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!insight) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          {insight.title || 'AI Insights'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700">{insight.summary}</p>

        {insight.keyPoints && insight.keyPoints.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Key Points</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              {insight.keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        {insight.suggestions && insight.suggestions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Suggestions</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              {insight.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        {insight.riskFlags && insight.riskFlags.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-orange-600">
              Risk Flags
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-orange-600">
              {insight.riskFlags.map((flag, index) => (
                <li key={index}>{flag}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

