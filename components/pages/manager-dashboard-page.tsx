'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, DollarSign, Receipt, ClipboardList, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
import { format } from 'date-fns'
import { MetricCard } from '@/components/ui/metric-card'
import { CardSkeletonLoader } from '@/components/ui/skeleton-loader'
import Link from 'next/link'

interface Metrics {
  assignedProperties: number
  monthRevenue: number
  monthExpenses: number
  monthNet: number
  pendingTasks: number
  recentBookings: Array<{
    id: string
    checkInDate: string
    totalPayout: number
    currency: Currency
    guestName?: string | null
    Property: { name: string }
    Owner: { name: string }
  }>
  properties: Array<{
    id: string
    name: string
    nickname?: string
    owner: string
  }>
}

export function ManagerDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/manager/metrics')
      if (!res.ok) {
        throw new Error(`Failed to fetch metrics: ${res.statusText}`)
      }
      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }
      // Ensure arrays are always defined
      setMetrics({
        assignedProperties: data.assignedProperties || 0,
        monthRevenue: data.monthRevenue || 0,
        monthExpenses: data.monthExpenses || 0,
        monthNet: data.monthNet || 0,
        pendingTasks: data.pendingTasks || 0,
        recentBookings: Array.isArray(data.recentBookings) ? data.recentBookings : [],
        properties: Array.isArray(data.properties) ? data.properties : [],
      })
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      setMetrics({
        assignedProperties: 0,
        monthRevenue: 0,
        monthExpenses: 0,
        monthNet: 0,
        pendingTasks: 0,
        recentBookings: [],
        properties: [],
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <CardSkeletonLoader />
      </div>
    )
  }

  if (!metrics) {
    return <div className="p-6 text-red-600">Failed to load dashboard data. Please try refreshing the page.</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Assigned Properties"
          value={typeof metrics.assignedProperties === 'number' ? metrics.assignedProperties : 0}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="This Month Revenue"
          value={formatCurrency(metrics.monthRevenue, Currency.GHS)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="This Month Expenses"
          value={formatCurrency(metrics.monthExpenses, Currency.GHS)}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Pending Tasks"
          value={typeof metrics.pendingTasks === 'number' ? metrics.pendingTasks : 0}
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Assigned Properties */}
      <Card>
        <CardHeader>
          <CardTitle>My Assigned Properties</CardTitle>
        </CardHeader>
        <CardContent>
          {!metrics.properties || metrics.properties.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No properties assigned yet
            </p>
          ) : (
            <div className="space-y-2">
              {metrics.properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/manager/properties/${property.id}`}
                  className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {property.nickname || property.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Owner: {property.owner}
                      </div>
                    </div>
                    <Building2 className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {!metrics.recentBookings || metrics.recentBookings.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No bookings found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.Property.name}
                    </TableCell>
                    <TableCell>{booking.Owner.name}</TableCell>
                    <TableCell>{booking.guestName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(booking.totalPayout, booking.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

