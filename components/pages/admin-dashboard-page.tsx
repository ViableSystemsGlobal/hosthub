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
import { Building2, DollarSign, Receipt, Percent, Wallet, TrendingUp, TrendingDown, Star, AlertTriangle, Lightbulb, ArrowRight, ClipboardList, Clock, CheckCircle2, Plus, Calendar, Bell, Package, Sparkles, Zap } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
import { format } from 'date-fns'
import { AIInsightCard } from '@/components/ai/ai-insight-card'
import { CardSkeletonLoader } from '@/components/ui/skeleton-loader'
import { MetricCard } from '@/components/ui/metric-card'
import { TrendChart } from '@/components/ui/trend-chart'
import { LineChart } from '@/components/ui/line-chart'
import { BarChart } from '@/components/ui/bar-chart'
import { PieChart } from '@/components/ui/pie-chart'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Metrics {
  activeProperties: number
  mtdRevenue: number
  mtdExpenses: number
  mtdCommission: number
  totalBalances: number
  totalCommissionsReceivable?: number
  recentBookings: Array<{
    id: string
    checkInDate: string
    totalPayout: number
    currency: Currency
    guestName?: string | null
    Property: { name: string }
    Owner: { name: string }
  }>
  upcomingBookings?: Array<{
    id: string
    checkInDate: string
    totalPayout: number
    currency: Currency
    guestName?: string | null
    Property: { name: string }
    Owner: { name: string }
  }>
  topProperties?: Array<{
    id: string
    name: string
    revenue: number
    occupancy: number
    revenueChange: number
    ownerName: string
  }>
  ownerBalances?: Array<{
    id: string
    name: string
    email: string
    propertyCount: number
    currentBalance: number
    commissionsPayable: number
    netBalance: number
  }>
  trends?: {
    revenue: { current: number; previous: number; change: number }
    expenses: { current: number; previous: number; change: number }
    commission: { current: number; previous: number; change: number }
  }
  dailyRevenueData?: number[]
  // Chart data
  revenueExpenseChart?: Array<{ label: string; revenue: number; expenses: number }>
  bookingTrends?: Array<{ label: string; value: number }>
  expenseBreakdown?: Array<{ label: string; value: number }>
  // Issue metrics
  openIssues?: number
  urgentIssues?: number
  mtdIssues?: number
  // Task metrics
  pendingTasks?: number
  overdueTasks?: number
  mtdTasks?: number
  // Recent activity
  recentIssues?: Array<{
    id: string
    type: string
    title: string
    status: string
    priority: string
    propertyName: string
    createdAt: string
  }>
  recentTasks?: Array<{
    id: string
    type: string
    title: string
    status: string
    propertyName: string
    createdAt: string
  }>
  recentExpenses?: Array<{
    id: string
    type: string
    description: string
    amount: number
    currency: Currency
    propertyName: string
    date: string
  }>
  // New feature metrics
  lowStockItems?: number
  pendingCleaningTasks?: number
  readyForGuestTasks?: number
  upcomingCheckIns?: Array<{
    id: string
    checkInDate: string
    guestName?: string | null
    propertyName: string
    propertyId: string
  }>
  recentCheckIns?: Array<{
    id: string
    checkInDate: string
    checkedInAt: string
    guestName?: string | null
    propertyName: string
    checkedInBy: string
    propertyId: string
  }>
  lowElectricityBalances?: number
  recentInventoryUpdates?: Array<{
    id: string
    itemName: string
    propertyName: string
    previousQuantity: number | null
    newQuantity: number | null
    changeType: string
    changedBy: string
    createdAt: string
  }>
}

export function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [insightsOpen, setInsightsOpen] = useState(false)

  useEffect(() => {
    fetchMetrics()
  }, [timePeriod])

  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams()
      params.append('period', timePeriod)
      const res = await fetch(`/api/admin/metrics?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch metrics: ${res.statusText}`)
      }
      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }
      setMetrics(data)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      // Set default empty metrics on error
      setMetrics({
        activeProperties: 0,
        mtdRevenue: 0,
        mtdExpenses: 0,
        mtdCommission: 0,
        totalBalances: 0,
        totalCommissionsReceivable: 0,
        recentBookings: [],
        topProperties: [],
        ownerBalances: [],
        openIssues: 0,
        urgentIssues: 0,
        mtdIssues: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        mtdTasks: 0,
        recentIssues: [],
        recentTasks: [],
        recentExpenses: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'week':
        return 'This Week'
      case 'quarter':
        return 'This Quarter'
      case 'year':
        return 'This Year'
      case 'month':
      default:
        return 'This Month'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <CardSkeletonLoader />
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metrics) {
    return <div className="p-6 text-red-600">Failed to load dashboard data. Please try refreshing the page.</div>
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
                  pageType="admin_dashboard"
                  context={metrics}
                />
              </div>
            </DrawerContent>
          </Drawer>
          <Select value={timePeriod} onValueChange={(value: 'week' | 'month' | 'quarter' | 'year') => setTimePeriod(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Link href="/admin/bookings/new">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            </Link>
            <Link href="/admin/issues/new">
              <Button variant="outline" size="sm">
                <AlertTriangle className="w-4 h-4 mr-2" />
                New Issue
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Properties
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeProperties}</div>
          </CardContent>
        </Card>

        <MetricCard
          title={`${getPeriodLabel()} Revenue`}
          value={formatCurrency(metrics.mtdRevenue, Currency.GHS)}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          trend={
            metrics.trends?.revenue
              ? {
                  value: metrics.trends.revenue.change,
                  period: 'vs previous period',
                  isPositive: metrics.trends.revenue.change >= 0,
                }
              : undefined
          }
          chart={
            metrics.dailyRevenueData ? (
              <TrendChart
                data={metrics.dailyRevenueData}
                isPositive={
                  metrics.trends?.revenue
                    ? metrics.trends.revenue.change >= 0
                    : undefined
                }
              />
            ) : undefined
          }
        />

        <MetricCard
          title={`${getPeriodLabel()} Expenses`}
          value={formatCurrency(metrics.mtdExpenses, Currency.GHS)}
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          trend={
            metrics.trends?.expenses
              ? {
                  value: metrics.trends.expenses.change,
                  period: 'vs previous period',
                  isPositive: metrics.trends.expenses.change <= 0, // Lower expenses is positive
                }
              : undefined
          }
        />

        <MetricCard
          title={`${getPeriodLabel()} Commission`}
          value={formatCurrency(metrics.mtdCommission, Currency.GHS)}
          icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          trend={
            metrics.trends?.commission
              ? {
                  value: metrics.trends.commission.change,
                  period: 'vs previous period',
                  isPositive: metrics.trends.commission.change >= 0,
                }
              : undefined
          }
        />

        {metrics.totalCommissionsReceivable !== undefined && (
          <MetricCard
            title="Commissions Receivable"
            value={formatCurrency(metrics.totalCommissionsReceivable, Currency.GHS)}
            icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            style={{ color: 'var(--theme-color, #f97316)' }}
          />
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Balances
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalBalances, Currency.GHS)}
            </div>
          </CardContent>
        </Card>

        {/* Issue Metrics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Open Issues
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.openIssues || 0}</div>
            {metrics.urgentIssues !== undefined && metrics.urgentIssues > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {metrics.urgentIssues} urgent
              </p>
            )}
          </CardContent>
        </Card>

        {/* Task Metrics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Tasks
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingTasks || 0}</div>
            {metrics.overdueTasks !== undefined && metrics.overdueTasks > 0 && (
              <p className="text-xs text-red-600 mt-1">
                {metrics.overdueTasks} overdue
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Insights - New Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Low Stock Alert */}
        <Card className={metrics.lowStockItems && metrics.lowStockItems > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Package className={`h-4 w-4 ${metrics.lowStockItems && metrics.lowStockItems > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.lowStockItems || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Items need restocking
            </p>
            {metrics.lowStockItems && metrics.lowStockItems > 0 && (
              <Link href="/admin/inventory-entry?type=CONSUMABLE">
                <Button variant="link" size="sm" className="p-0 h-auto mt-2">
                  View Items <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Pending Cleaning Tasks */}
        <Card 
          className={metrics.pendingCleaningTasks && metrics.pendingCleaningTasks > 0 ? '' : ''}
          style={metrics.pendingCleaningTasks && metrics.pendingCleaningTasks > 0 ? { 
            borderColor: 'var(--theme-color-light, rgba(249, 115, 22, 0.2))', 
            backgroundColor: 'var(--theme-color-lighter, rgba(249, 115, 22, 0.05))' 
          } : undefined}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Cleaning</CardTitle>
            <Sparkles 
              className="h-4 w-4"
              style={metrics.pendingCleaningTasks && metrics.pendingCleaningTasks > 0 ? { color: 'var(--theme-color, #f97316)' } : undefined}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingCleaningTasks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tasks pending completion
            </p>
            {metrics.pendingCleaningTasks && metrics.pendingCleaningTasks > 0 && (
              <Link href="/admin/cleaning-tasks">
                <Button variant="link" size="sm" className="p-0 h-auto mt-2">
                  View Tasks <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Ready for Guest */}
        <Card className={metrics.readyForGuestTasks && metrics.readyForGuestTasks > 0 ? 'border-green-200 bg-green-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Guest</CardTitle>
            <CheckCircle2 className={`h-4 w-4 ${metrics.readyForGuestTasks && metrics.readyForGuestTasks > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.readyForGuestTasks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Properties cleaned & ready
            </p>
            {metrics.readyForGuestTasks && metrics.readyForGuestTasks > 0 && (
              <Link href="/admin/cleaning-tasks?status=COMPLETED">
                <Button variant="link" size="sm" className="p-0 h-auto mt-2">
                  View Ready <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Low Electricity */}
        <Card className={metrics.lowElectricityBalances && metrics.lowElectricityBalances > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Electricity</CardTitle>
            <Zap className={`h-4 w-4 ${metrics.lowElectricityBalances && metrics.lowElectricityBalances > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.lowElectricityBalances || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Properties need top-up
            </p>
            {metrics.lowElectricityBalances && metrics.lowElectricityBalances > 0 && (
              <Link href="/admin/electricity-readings">
                <Button variant="link" size="sm" className="p-0 h-auto mt-2">
                  View Readings <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Check-Ins */}
      {metrics.upcomingCheckIns && metrics.upcomingCheckIns.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Check-Ins (Next 7 Days)</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/checkin">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.upcomingCheckIns.map((booking) => (
                <Link key={booking.id} href={`/admin/checkin`}>
                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {booking.guestName || 'Guest'} - {booking.propertyName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bookings</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/bookings">View all <ArrowRight className="w-4 h-4 ml-1" /></a>
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="recent" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              </TabsList>
              
              <TabsContent value="recent" className="mt-0">
                {metrics.recentBookings && Array.isArray(metrics.recentBookings) && metrics.recentBookings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.recentBookings.slice(0, 5).map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.Property?.name || '-'}
                          </TableCell>
                          <TableCell>{booking.guestName || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(booking.totalPayout || 0, booking.currency || Currency.GHS)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent bookings
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="upcoming" className="mt-0">
                {metrics.upcomingBookings && Array.isArray(metrics.upcomingBookings) && metrics.upcomingBookings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.upcomingBookings.slice(0, 5).map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.Property?.name || '-'}
                          </TableCell>
                          <TableCell>{booking.guestName || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(booking.totalPayout || 0, booking.currency || Currency.GHS)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming bookings
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Top Performing Properties */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Properties</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topProperties && metrics.topProperties.length > 0 ? (
              <div className="space-y-4">
                {metrics.topProperties.map((property, index) => (
                  <div key={property.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{property.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {property.occupancy.toFixed(0)}% occupancy
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(property.revenue, Currency.GHS)}
                      </p>
                      <p className={`text-sm flex items-center gap-1 ${
                        property.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {property.revenueChange >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Math.abs(property.revenueChange).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No property data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Owner Balances and Recent Activity - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Owner Balances */}
        {metrics.ownerBalances && metrics.ownerBalances.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Owner Balances</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <a href="/admin/owners">Manage <ArrowRight className="w-4 h-4 ml-1" /></a>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.ownerBalances.map((owner) => (
                  <div key={owner.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {owner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{owner.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {owner.propertyCount} {owner.propertyCount === 1 ? 'property' : 'properties'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        owner.netBalance > 0 ? 'text-green-600' : owner.netBalance < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {owner.netBalance > 0 
                          ? `+${formatCurrency(owner.netBalance, Currency.GHS)} We owe`
                          : owner.netBalance < 0
                          ? `${formatCurrency(Math.abs(owner.netBalance), Currency.GHS)} Owes us`
                          : formatCurrency(0, Currency.GHS) + ' Settled'
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {(() => {
                // Combine all recent activity items
                const allActivities: Array<{
                  id: string
                  type: 'issue' | 'task' | 'expense' | 'checkIn' | 'inventory'
                  timestamp: Date
                  element: React.ReactNode
                }> = []

                // Add issues
                if (metrics.recentIssues && metrics.recentIssues.length > 0) {
                  metrics.recentIssues.forEach((issue) => {
                    allActivities.push({
                      id: `issue-${issue.id}`,
                      type: 'issue',
                      timestamp: new Date(issue.createdAt),
                      element: (
                        <div key={issue.id} className="flex items-start gap-3 p-2 border rounded-lg">
                          <AlertTriangle 
                            className="w-4 h-4 mt-0.5"
                            style={{
                              color: issue.priority === 'URGENT' 
                                ? '#dc2626' 
                                : issue.priority === 'HIGH' 
                                  ? 'var(--theme-color, #f97316)' 
                                  : '#4B5563'
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{issue.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {issue.propertyName} • {format(new Date(issue.createdAt), 'MMM dd')}
                            </p>
                          </div>
                        </div>
                      ),
                    })
                  })
                }

                // Add tasks
                if (metrics.recentTasks && metrics.recentTasks.length > 0) {
                  metrics.recentTasks.forEach((task) => {
                    allActivities.push({
                      id: `task-${task.id}`,
                      type: 'task',
                      timestamp: new Date(task.createdAt),
                      element: (
                        <div key={task.id} className="flex items-start gap-3 p-2 border rounded-lg">
                          <ClipboardList className="w-4 h-4 mt-0.5 text-blue-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.propertyName} • {format(new Date(task.createdAt), 'MMM dd')}
                            </p>
                          </div>
                        </div>
                      ),
                    })
                  })
                }

                // Add expenses
                if (metrics.recentExpenses && metrics.recentExpenses.length > 0) {
                  metrics.recentExpenses.forEach((expense) => {
                    allActivities.push({
                      id: `expense-${expense.id}`,
                      type: 'expense',
                      timestamp: new Date(expense.date),
                      element: (
                        <div key={expense.id} className="flex items-start gap-3 p-2 border rounded-lg">
                          <Receipt className="w-4 h-4 mt-0.5 text-green-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{expense.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {expense.propertyName} • {formatCurrency(expense.amount, expense.currency)} • {format(new Date(expense.date), 'MMM dd')}
                            </p>
                          </div>
                        </div>
                      ),
                    })
                  })
                }

                // Add check-ins
                if (metrics.recentCheckIns && metrics.recentCheckIns.length > 0) {
                  metrics.recentCheckIns.forEach((checkIn) => {
                    allActivities.push({
                      id: `checkin-${checkIn.id}`,
                      type: 'checkIn',
                      timestamp: new Date(checkIn.checkedInAt),
                      element: (
                        <Link key={checkIn.id} href={`/admin/properties/${checkIn.propertyId}`}>
                          <div className="flex items-start gap-3 p-2 border rounded-lg hover:bg-gray-50 transition-colors">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {checkIn.guestName || 'Guest'} checked in
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {checkIn.propertyName} • {format(new Date(checkIn.checkedInAt), 'MMM dd HH:mm')} by {checkIn.checkedInBy}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ),
                    })
                  })
                }

                // Add inventory updates
                if (metrics.recentInventoryUpdates && metrics.recentInventoryUpdates.length > 0) {
                  metrics.recentInventoryUpdates.forEach((update) => {
                    allActivities.push({
                      id: `inventory-${update.id}`,
                      type: 'inventory',
                      timestamp: new Date(update.createdAt),
                      element: (
                        <Link key={update.id} href={`/admin/inventory-entry`}>
                          <div className="flex items-start gap-3 p-2 border rounded-lg hover:bg-gray-50 transition-colors">
                            <Package className="w-4 h-4 mt-0.5 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {update.itemName} - {update.changeType}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {update.previousQuantity !== null ? `${update.previousQuantity}` : '-'} → {update.newQuantity !== null ? `${update.newQuantity}` : '-'} • {update.propertyName} • {format(new Date(update.createdAt), 'MMM dd')}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ),
                    })
                  })
                }

                // Sort by timestamp (most recent first)
                allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

                // Display sorted activities
                if (allActivities.length > 0) {
                  return allActivities.slice(0, 10).map((activity) => activity.element)
                }

                return (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Chart */}
        {metrics.revenueExpenseChart && metrics.revenueExpenseChart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                data={metrics.revenueExpenseChart.map(d => ({ label: d.label, value: d.revenue }))}
                data2={metrics.revenueExpenseChart.map(d => ({ label: d.label, value: d.expenses }))}
                height={250}
                color="#3b82f6"
                color2="#ef4444"
              />
              <div className="flex items-center gap-4 mt-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-gray-600">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600">Expenses</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Trends Chart */}
        {metrics.bookingTrends && metrics.bookingTrends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Booking Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={metrics.bookingTrends}
                height={250}
                color="#10b981"
              />
            </CardContent>
          </Card>
        )}

        {/* Expense Breakdown */}
        {metrics.expenseBreakdown && metrics.expenseBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChart
                data={metrics.expenseBreakdown}
                height={300}
              />
            </CardContent>
          </Card>
        )}

        {/* Property Performance Comparison */}
        {metrics.topProperties && metrics.topProperties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Property Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={metrics.topProperties.map(p => ({
                  label: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
                  value: p.revenue,
                }))}
                height={250}
                color="#8b5cf6"
              />
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  )
}

