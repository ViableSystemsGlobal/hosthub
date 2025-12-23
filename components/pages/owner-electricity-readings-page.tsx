'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Zap, Filter, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

interface Reading {
  id: string
  readingDate: Date
  balance: number
  unit: string
  EnteredBy: {
    id: string
    name: string
    email: string
  }
  Property: {
    id: string
    name: string
    nickname: string | null
    electricityMeterMinimumBalance: number | null
  }
}

interface Alert {
  id: string
  alertSentAt: Date
  resolvedAt: Date | null
  Reading: Reading
}

export function OwnerElectricityReadingsPage() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; name: string; nickname: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState<string>('all')

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    if (properties.length > 0) {
      fetchReadings()
      fetchAlerts()
    }
  }, [propertyFilter, properties])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setProperties(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchReadings = async () => {
    try {
      setLoading(true)
      const propertyIds = propertyFilter === 'all' 
        ? properties.map(p => p.id)
        : [propertyFilter]

      const allReadings: Reading[] = []
      for (const propertyId of propertyIds) {
        const res = await fetch(`/api/properties/${propertyId}/electricity-readings`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          allReadings.push(...(Array.isArray(data) ? data : []))
        }
      }

      setReadings(allReadings.sort((a, b) => 
        new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime()
      ))
    } catch (error) {
      console.error('Failed to fetch readings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const propertyIds = propertyFilter === 'all' 
        ? properties.map(p => p.id)
        : [propertyFilter]

      const allAlerts: Alert[] = []
      for (const propertyId of propertyIds) {
        const res = await fetch(`/api/properties/${propertyId}/electricity-alerts`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          allAlerts.push(...(Array.isArray(data) ? data : []))
        }
      }

      setAlerts(allAlerts.filter(a => !a.resolvedAt).sort((a, b) => 
        new Date(b.alertSentAt).getTime() - new Date(a.alertSentAt).getTime()
      ))
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6" />
            Electricity Readings
          </h1>
          <p className="text-gray-600 mt-1">View electricity meter readings and alerts for your properties</p>
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-3 bg-white rounded border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {alert.Reading.Property.nickname || alert.Reading.Property.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Balance: {alert.Reading.balance} {alert.Reading.unit} (Below minimum: {alert.Reading.Property.electricityMeterMinimumBalance || 0} {alert.Reading.unit})
                      </p>
                      <p className="text-xs text-gray-500">
                        Alert sent: {format(new Date(alert.alertSentAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">Property</label>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.nickname || property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Readings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Readings</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No electricity readings found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.map((reading) => {
                  const isLow = reading.Property.electricityMeterMinimumBalance !== null &&
                    reading.balance < reading.Property.electricityMeterMinimumBalance
                  return (
                    <TableRow key={reading.id}>
                      <TableCell className="font-medium">
                        {reading.Property.nickname || reading.Property.name}
                      </TableCell>
                      <TableCell>
                        {format(new Date(reading.readingDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {reading.balance} {reading.unit}
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge className="bg-red-100 text-red-800">Low Balance</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {reading.EnteredBy.name}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

