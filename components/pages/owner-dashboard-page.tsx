'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DollarSign, 
  Receipt, 
  TrendingUp, 
  Wallet, 
  Calendar, 
  Building2,
  ArrowRight,
  CalendarCheck,
  Sparkles,
  Zap,
  Package,
  AlertTriangle
} from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { formatCurrency } from '@/lib/currency'
import { Currency, BookingStatus } from '@prisma/client'
import { format } from 'date-fns'
import { AIInsightCard } from '@/components/ai/ai-insight-card'
import { CardSkeletonLoader } from '@/components/ui/skeleton-loader'
import { MetricCard } from '@/components/ui/metric-card'
import { OwnerForecast } from '@/components/pages/owner-forecast'
import { useSession } from 'next-auth/react'
import { PropertyForecast } from '@/components/pages/property-forecast'
import { TrendChart } from '@/components/ui/trend-chart'

interface Metrics {
  monthRevenue: number
  monthExpenses: number
  monthNet: number
  currentBalance: number
  commissionsPayable?: number
  properties: Array<{
    id: string
    name: string
    revenue: number
  }>
  recentBookings?: Array<{
    id: string
    propertyName: string
    guestName?: string | null
    checkInDate: string
    checkOutDate: string
    totalPayout: number
    currency: Currency
    status: BookingStatus
  }>
  upcomingBookings?: Array<{
    id: string
    propertyName: string
    guestName?: string | null
    checkInDate: string
    checkOutDate: string
    nights: number
    totalPayout: number
    currency: Currency
  }>
  trends?: {
    revenue: { current: number; previous: number; change: number }
    expenses: { current: number; previous: number; change: number }
    net: { current: number; previous: number; change: number }
  }
  dailyRevenueData?: number[]
  pendingCleaningTasks?: number
  readyForGuestTasks?: number
  recentCheckIns?: Array<{
    id: string
    propertyName: string
    guestName?: string | null
    checkedInAt?: string
    checkedInBy?: string
  }>
  lowElectricityBalances?: number
  lowStockItems?: number
}

export function OwnerDashboardPage() {
  const { data: session } = useSession()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState<Currency>(Currency.GHS)
  const [insightsOpen, setInsightsOpen] = useState(false)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/owner/metrics', {
        credentials: 'include',
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch metrics' }))
        throw new Error(errorData.error || `Failed to fetch metrics: ${res.statusText}`)
      }
      const data = await res.json()
      
      // Ensure all numeric values are valid numbers
      setMetrics({
        monthRevenue: data.monthRevenue ?? 0,
        monthExpenses: data.monthExpenses ?? 0,
        monthNet: data.monthNet ?? 0,
        currentBalance: data.currentBalance ?? 0,
        commissionsPayable: data.commissionsPayable ?? 0,
        properties: Array.isArray(data.properties) ? data.properties : [],
      })
      
      // Get currency from owner data if available
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      // Set default values on error
      setMetrics({
        monthRevenue: 0,
        monthExpenses: 0,
        monthNet: 0,
        currentBalance: 0,
        commissionsPayable: 0,
        properties: [],
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <CardSkeletonLoader count={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Drawer open={insightsOpen} onOpenChange={setInsightsOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Insights
              </Button>
            </DrawerTrigger>
            <DrawerContent side="right" className="overflow-y-auto">
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Insights
                </DrawerTitle>
              </DrawerHeader>
              <div className="px-6 pb-6">
                <AIInsightCard
                  pageType="owner_dashboard"
                  context={metrics}
                  ownerId={session?.user?.ownerId || undefined}
                  currency={currency}
                />
              </div>
            </DrawerContent>
          </Drawer>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/owner/properties">
              <Building2 className="w-4 h-4 mr-2" />
              Properties
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/owner/statements">
              <Receipt className="w-4 h-4 mr-2" />
              Statements
            </Link>
          </Button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="This Month Revenue"
          value={formatCurrency(metrics.monthRevenue, currency)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          trend={metrics.trends?.revenue ? {
            value: metrics.trends.revenue.change,
            period: 'vs last month',
            isPositive: metrics.trends.revenue.change >= 0,
          } : undefined}
        />

        <MetricCard
          title="This Month Expenses"
          value={formatCurrency(metrics.monthExpenses, currency)}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          trend={metrics.trends?.expenses ? {
            value: metrics.trends.expenses.change,
            period: 'vs last month',
            isPositive: metrics.trends.expenses.change <= 0, // Lower expenses is better
          } : undefined}
        />

        <MetricCard
          title="This Month Net"
          value={formatCurrency(metrics.monthNet, currency)}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          trend={metrics.trends?.net ? {
            value: metrics.trends.net.change,
            period: 'vs last month',
            isPositive: metrics.trends.net.change >= 0,
          } : undefined}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.currentBalance, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.currentBalance > 0
                ? 'We owe you'
                : metrics.currentBalance < 0
                ? 'You owe us'
                : 'Balanced'}
            </p>
          </CardContent>
        </Card>

        {metrics.commissionsPayable !== undefined && metrics.commissionsPayable > 0 && (
          <Card className="border-orange-200 md:col-span-2 lg:col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">
                Commissions Payable
              </CardTitle>
              <Receipt className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(metrics.commissionsPayable, currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding commission balance
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Revenue Trend Chart */}
      {metrics.dailyRevenueData && metrics.dailyRevenueData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={metrics.dailyRevenueData} />
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      {(metrics.pendingCleaningTasks !== undefined || metrics.readyForGuestTasks !== undefined || 
        metrics.lowElectricityBalances !== undefined || metrics.lowStockItems !== undefined) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.pendingCleaningTasks !== undefined && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Cleaning</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.pendingCleaningTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">Tasks pending completion</p>
              </CardContent>
            </Card>
          )}
          {metrics.readyForGuestTasks !== undefined && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready for Guest</CardTitle>
                <CalendarCheck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{metrics.readyForGuestTasks}</div>
                <p className="text-xs text-muted-foreground mt-1">Properties ready</p>
              </CardContent>
            </Card>
          )}
          {metrics.lowElectricityBalances !== undefined && (
            <Card className={metrics.lowElectricityBalances > 0 ? 'border-orange-200' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Electricity</CardTitle>
                <Zap className={`h-4 w-4 ${metrics.lowElectricityBalances > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.lowElectricityBalances > 0 ? 'text-orange-600' : ''}`}>
                  {metrics.lowElectricityBalances}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active alerts</p>
              </CardContent>
            </Card>
          )}
          {metrics.lowStockItems !== undefined && (
            <Card className={metrics.lowStockItems > 0 ? 'border-orange-200' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <Package className={`h-4 w-4 ${metrics.lowStockItems > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metrics.lowStockItems > 0 ? 'text-orange-600' : ''}`}>
                  {metrics.lowStockItems}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Items below minimum</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Properties Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Properties Performance</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/owner/properties">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {metrics.properties && metrics.properties.length > 0 ? (
              <div className="space-y-3">
                {metrics.properties.map((property) => (
                  <div key={property.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{property.name}</p>
                        <p className="text-sm text-muted-foreground">This month</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(property.revenue, currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No properties found
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.upcomingBookings && metrics.upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {metrics.upcomingBookings.map((booking) => (
                  <div key={booking.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{booking.propertyName}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.guestName || 'Guest'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(booking.checkInDate), 'MMM dd')} - {format(new Date(booking.checkOutDate), 'MMM dd')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(booking.totalPayout, booking.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.nights} {booking.nights === 1 ? 'night' : 'nights'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming bookings
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Check-Ins */}
      {metrics.recentCheckIns && metrics.recentCheckIns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Check-Ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentCheckIns.map((checkIn) => (
                <div key={checkIn.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{checkIn.propertyName}</p>
                      <p className="text-sm text-muted-foreground">
                        {checkIn.guestName || 'Guest'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Checked in: {checkIn.checkedInAt ? format(new Date(checkIn.checkedInAt), 'MMM dd, yyyy HH:mm') : '-'}
                      </p>
                      {checkIn.checkedInBy && (
                        <p className="text-xs text-muted-foreground">
                          By: {checkIn.checkedInBy}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Bookings */}
      {metrics.recentBookings && metrics.recentBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.recentBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.propertyName}
                    </TableCell>
                    <TableCell>{booking.guestName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(booking.totalPayout, booking.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          booking.status === BookingStatus.COMPLETED
                            ? 'default'
                            : booking.status === BookingStatus.CANCELLED
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {booking.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Forecast */}
      <OwnerForecast ownerId={session?.user?.ownerId || undefined} />
    </div>
  )
}

