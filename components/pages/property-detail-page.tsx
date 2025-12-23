'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TrendingUp, Receipt, DollarSign, ArrowLeft, Image as ImageIcon, ExternalLink, Bed, Bath, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { AIInsightCard } from '@/components/ai/ai-insight-card'
import { DocumentManager } from '@/components/ui/document-manager'
import { PropertyForecast } from '@/components/pages/property-forecast'
import { ElectricityMeter } from '@/components/ui/electricity-meter'
import { InventoryManager } from '@/components/ui/inventory-manager'

interface PropertyDetailPageProps {
  propertyId: string
}

export function PropertyDetailPage({ propertyId }: PropertyDetailPageProps) {
  const pathname = usePathname()
  const [metrics, setMetrics] = useState<any>(null)
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(
    startOfMonth(new Date()).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    endOfMonth(new Date()).toISOString().split('T')[0]
  )

  // Determine the back URL based on current path
  const backUrl = pathname?.startsWith('/admin')
    ? '/admin/properties'
    : pathname?.startsWith('/manager')
    ? '/manager/properties'
    : '/owner/properties'

  useEffect(() => {
    fetchProperty()
    fetchMetrics()
  }, [propertyId, startDate, endDate])

  const fetchProperty = async () => {
    if (!propertyId) return
    
    try {
      const res = await fetch(`/api/properties/${propertyId}`)
      if (res.ok) {
        const data = await res.json()
        setProperty(data)
      }
    } catch (error) {
      console.error('Failed to fetch property:', error)
    }
  }

  const fetchMetrics = async () => {
    if (!propertyId) {
      console.error('Property ID is missing')
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams()
      params.append('startDate', startDate)
      params.append('endDate', endDate)

      const res = await fetch(`/api/properties/${propertyId}/metrics?${params}`)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(errorData.error || `Failed to fetch metrics: ${res.statusText}`)
      }
      
      const data = await res.json()
      
      // Check if response has error
      if (data.error) {
        throw new Error(data.error)
      }
      
      // Ensure all required fields exist with defaults
      setMetrics({
        occupancy: data.occupancy ?? 0,
        revenue: data.revenue ?? 0,
        expenses: data.expenses ?? 0,
        net: data.net ?? 0,
        bookings: data.bookings ?? [],
        expensesList: data.expensesList ?? [],
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      })
    } catch (error: any) {
      console.error('Failed to fetch metrics:', error)
      // Set default metrics on error
      setMetrics({
        occupancy: 0,
        revenue: 0,
        expenses: 0,
        net: 0,
        bookings: [],
        expensesList: [],
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {property?.nickname || property?.name || 'Property Details'}
        </h1>
      </div>

      {/* Property Information Card */}
      {property && (
        <Card>
          <CardHeader>
            <CardTitle>Property Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Property Images */}
            {property.photos && property.photos.length > 0 && (
              <div className="space-y-2">
                <Label>Photos</Label>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {property.photos.map((photo: string, index: number) => (
                    <div key={index} className="relative group flex-shrink-0">
                      <img
                        src={photo}
                        alt={`${property.name} ${index + 1}`}
                        className="w-64 h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(photo, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Property Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-lg font-semibold">{property.name}</p>
                </div>
                {property.nickname && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Nickname</Label>
                    <p className="text-lg">{property.nickname}</p>
                  </div>
                )}
                {property.address && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                    <p>{property.address}</p>
                  </div>
                )}
                {(property.city || property.country) && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                    <p>{[property.city, property.country].filter(Boolean).join(', ')}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Property Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {property.bedrooms && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <Bed className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{property.bedrooms}</p>
                      <p className="text-xs text-muted-foreground">Bedrooms</p>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <Bath className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{property.bathrooms}</p>
                      <p className="text-xs text-muted-foreground">Bathrooms</p>
                    </div>
                  )}
                  {property.maxGuests && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-2xl font-bold">{property.maxGuests}</p>
                      <p className="text-xs text-muted-foreground">Max Guests</p>
                    </div>
                  )}
                </div>

                {/* External Links */}
                <div className="space-y-2">
                  {property.airbnbListingId && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://www.airbnb.com/rooms/${property.airbnbListingId}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View on Airbnb
                      </Button>
                    </div>
                  )}
                  {property.bookingComId && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Booking.com ID: {property.bookingComId}</Label>
                    </div>
                  )}
                  {property.instagramHandle && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Instagram: {property.instagramHandle}</Label>
                    </div>
                  )}
                </div>

                {/* Description */}
                {property.description && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1">{property.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {property.amenities && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Amenities</Label>
                    <p className="text-sm mt-1">{property.amenities}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Period Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchMetrics} className="w-full">
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.occupancy ?? 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.revenue ?? 0, Currency.GHS)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.expenses ?? 0, Currency.GHS)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.net ?? 0, Currency.GHS)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings and Expenses Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bookings">
            <TabsList>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
            </TabsList>
            <TabsContent value="bookings">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(metrics.bookings ?? []).map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(booking.checkOutDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{booking.nights}</TableCell>
                      <TableCell>
                        {formatCurrency(booking.totalPayout, booking.currency)}
                      </TableCell>
                      <TableCell>{booking.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="expenses">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.expensesList?.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        {formatCurrency(expense.amount, expense.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="forecast">
              <PropertyForecast propertyId={propertyId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Electricity Meter */}
      <ElectricityMeter
        propertyId={propertyId}
        minimumBalance={property?.electricityMeterMinimumBalance}
        unit={property?.electricityMeterUnit}
        canEdit={pathname?.startsWith('/admin') || pathname?.startsWith('/manager')}
      />

      {/* Inventory Management */}
      {(pathname?.startsWith('/admin') || pathname?.startsWith('/manager')) && (
        <InventoryManager propertyId={propertyId} />
      )}

      {/* Documents */}
      <DocumentManager propertyId={propertyId} title="Property Documents" />

      {/* AI Insight Card */}
      <AIInsightCard
        pageType="property_page"
        context={metrics}
        propertyId={propertyId}
      />
    </div>
  )
}

