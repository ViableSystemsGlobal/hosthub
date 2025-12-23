'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart } from '@/components/ui/line-chart'
import { BarChart } from '@/components/ui/bar-chart'
import { Loader2, Calendar, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, Currency } from '@/lib/currency'
import { format, addMonths } from 'date-fns'

interface AIForecast {
  forecastMonthlyRevenue: number[]
  forecastOccupancy: number[]
  narrative: string
  low: number
  expected: number
  high: number
}

interface PropertyForecastProps {
  propertyId: string
}

export function PropertyForecast({ propertyId }: PropertyForecastProps) {
  const [forecast, setForecast] = useState<AIForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  const generateForecast = async () => {
    if (!propertyId) return

    setLoading(true)
    setForecast(null)

    try {
      const res = await fetch(`/api/ai/forecast?propertyId=${propertyId}`)
      if (!res.ok) {
        throw new Error('Failed to generate forecast')
      }

      const data = await res.json()
      setForecast(data)
      setHasGenerated(true)
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate forecast')
    } finally {
      setLoading(false)
    }
  }

  // Generate month labels for the next 6 months
  const getMonthLabels = () => {
    const labels = []
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      labels.push(format(addMonths(now, i + 1), 'MMM yyyy'))
    }
    return labels
  }

  const monthLabels = getMonthLabels()

  // Prepare revenue chart data
  const revenueChartData = forecast
    ? forecast.forecastMonthlyRevenue.map((value, index) => ({
        label: monthLabels[index] || `Month ${index + 1}`,
        value: value || 0,
      }))
    : []

  // Prepare occupancy chart data
  const occupancyChartData = forecast
    ? forecast.forecastOccupancy.map((value, index) => ({
        label: monthLabels[index] || `Month ${index + 1}`,
        value: value || 0,
      }))
    : []

  if (!hasGenerated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>6-Month Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Generate AI-powered revenue and occupancy forecasts for the next 6 months
            </p>
            <Button onClick={generateForecast} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Generate Forecast
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expected Revenue (6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(forecast?.expected || 0, Currency.GHS)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(forecast?.low || 0, Currency.GHS)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(forecast?.high || 0, Currency.GHS)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <LineChart
                data={revenueChartData}
                height={250}
                color="#3b82f6"
                showGrid={true}
                showLabels={true}
              />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Occupancy Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyChartData.length > 0 ? (
              <BarChart
                data={occupancyChartData}
                height={250}
                color="#10b981"
                showGrid={true}
                showLabels={true}
              />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Narrative */}
      {forecast?.narrative && (
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {forecast.narrative}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Regenerate Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={generateForecast} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            'Regenerate Forecast'
          )}
        </Button>
      </div>
    </div>
  )
}

