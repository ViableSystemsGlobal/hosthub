'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { LineChart } from '@/components/ui/line-chart'
import { BarChart } from '@/components/ui/bar-chart'
import { Loader2, TrendingUp, TrendingDown, Calendar, Building2, Users } from 'lucide-react'
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

export function ForecastPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')
  const [forecast, setForecast] = useState<AIForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [forecastType, setForecastType] = useState<'property' | 'owner'>('property')

  useEffect(() => {
    fetchProperties()
    fetchOwners()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      setProperties(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      const data = await res.json()
      setOwners(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const generateForecast = async () => {
    if (forecastType === 'property' && !selectedPropertyId) {
      toast.error('Please select a property')
      return
    }
    if (forecastType === 'owner' && !selectedOwnerId) {
      toast.error('Please select an owner')
      return
    }

    setLoading(true)
    setForecast(null)

    try {
      const params = new URLSearchParams()
      if (forecastType === 'property' && selectedPropertyId) {
        params.append('propertyId', selectedPropertyId)
      } else if (forecastType === 'owner' && selectedOwnerId) {
        params.append('ownerId', selectedOwnerId)
      }

      const res = await fetch(`/api/ai/forecast?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to generate forecast')
      }

      const data = await res.json()
      setForecast(data)
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
  const revenueChartData = forecast && Array.isArray(forecast.forecastMonthlyRevenue)
    ? forecast.forecastMonthlyRevenue.map((value, index) => ({
        label: monthLabels[index] || `Month ${index + 1}`,
        value: typeof value === 'number' ? value : 0,
      }))
    : []

  // Prepare occupancy chart data
  const occupancyChartData = forecast && Array.isArray(forecast.forecastOccupancy)
    ? forecast.forecastOccupancy.map((value, index) => ({
        label: monthLabels[index] || `Month ${index + 1}`,
        value: typeof value === 'number' ? value : 0,
      }))
    : []

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId)
  const selectedOwner = owners.find((o) => o.id === selectedOwnerId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revenue & Occupancy Forecast</h1>
      </div>

      {/* Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="property"
                name="forecastType"
                checked={forecastType === 'property'}
                onChange={() => {
                  setForecastType('property')
                  setSelectedOwnerId('')
                  setForecast(null)
                }}
                className="w-4 h-4"
              />
              <Label htmlFor="property" className="cursor-pointer">
                <Building2 className="w-4 h-4 inline mr-1" />
                Property
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="owner"
                name="forecastType"
                checked={forecastType === 'owner'}
                onChange={() => {
                  setForecastType('owner')
                  setSelectedPropertyId('')
                  setForecast(null)
                }}
                className="w-4 h-4"
              />
              <Label htmlFor="owner" className="cursor-pointer">
                <Users className="w-4 h-4 inline mr-1" />
                Owner Portfolio
              </Label>
            </div>
          </div>

          {forecastType === 'property' ? (
            <div className="space-y-2">
              <Label htmlFor="property-select">Select Property</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger id="property-select">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="owner-select">Select Owner</Label>
              <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                <SelectTrigger id="owner-select">
                  <SelectValue placeholder="Select an owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={generateForecast}
            disabled={loading || (forecastType === 'property' && !selectedPropertyId) || (forecastType === 'owner' && !selectedOwnerId)}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Forecast...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Generate 6-Month Forecast
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Forecast Results */}
      {forecast && (
        <>
          {/* Empty State Warning */}
          {forecast.expected === 0 && forecast.low === 0 && forecast.high === 0 && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 mb-1">No Historical Data Available</p>
                    <p className="text-sm text-yellow-800">
                      The forecast shows zero values because there's no completed booking data from the last 12 months. 
                      To generate accurate forecasts, you need to:
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-yellow-800 space-y-1">
                      <li>Add completed bookings to your system</li>
                      <li>Ensure bookings have a status of "COMPLETED"</li>
                      <li>Wait for at least 1-2 months of booking history</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                  {formatCurrency(typeof forecast.expected === 'number' ? forecast.expected : 0, Currency.GHS)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on historical trends
                </p>
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
                  {formatCurrency(typeof forecast.low === 'number' ? forecast.low : 0, Currency.GHS)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Conservative scenario
                </p>
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
                  {formatCurrency(typeof forecast.high === 'number' ? forecast.high : 0, Currency.GHS)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Optimistic scenario
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Forecast Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecast (Next 6 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueChartData.length > 0 ? (
                  <LineChart
                    data={revenueChartData}
                    height={300}
                    color="#3b82f6"
                    showGrid={true}
                    showLabels={true}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Occupancy Forecast Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Occupancy Forecast (Next 6 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                {occupancyChartData.length > 0 ? (
                  <BarChart
                    data={occupancyChartData}
                    height={300}
                    color="#10b981"
                    showGrid={true}
                    showLabels={true}
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No occupancy data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Narrative */}
          {forecast.narrative && typeof forecast.narrative === 'string' && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis & Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {forecast.narrative}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Context Info */}
          <Card className="bg-blue-50">
            <CardContent className="pt-6">
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-2">Forecast Context:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>
                    Forecast based on historical data from the last 12 months
                  </li>
                  {forecastType === 'property' && selectedProperty && (
                    <li>Property: {selectedProperty.name}</li>
                  )}
                  {forecastType === 'owner' && selectedOwner && (
                    <li>Owner Portfolio: {selectedOwner.name}</li>
                  )}
                  <li>
                    Forecasts are AI-generated and should be used as guidance
                    only
                  </li>
                  <li>
                    Actual results may vary based on market conditions,
                    seasonality, and other factors
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

