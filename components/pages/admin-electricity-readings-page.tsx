'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Zap, Plus, Search, Building2, Settings } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { EmptyState } from '@/components/ui/empty-state'
import Link from 'next/link'

interface Property {
  id: string
  name: string
  nickname?: string | null
  electricityMeterMinimumBalance?: number | null
  electricityMeterUnit?: string | null
  status: string
  Owner: {
    name: string
  }
}

interface Reading {
  id: string
  balance: number
  readingDate: string
  notes?: string | null
  EnteredBy?: {
    name?: string | null
  } | null
}

export function AdminElectricityReadingsPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [readings, setReadings] = useState<Record<string, Reading>>({})
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [balance, setBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [currentUnit, setCurrentUnit] = useState('GHS')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/properties', {
        credentials: 'include',
      })

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        throw new Error('Failed to fetch properties')
      }

      const data = await res.json()
      const propertiesList = Array.isArray(data) ? data : []
      setProperties(propertiesList)

      // Fetch latest reading for each property
      const readingsMap: Record<string, Reading> = {}
      await Promise.all(
        propertiesList.map(async (prop: Property) => {
          try {
            const readingRes = await fetch(
              `/api/properties/${prop.id}/electricity-readings`,
              { credentials: 'include' }
            )
            if (readingRes.ok) {
              const readingData = await readingRes.json()
              if (Array.isArray(readingData) && readingData.length > 0) {
                readingsMap[prop.id] = readingData[0] // Latest reading
              }
            }
          } catch (error) {
            console.error(`Failed to fetch reading for ${prop.id}:`, error)
          }
        })
      )
      setReadings(readingsMap)
    } catch (error) {
      console.error('Failed to fetch properties:', error)
      setProperties([])
      toast.error('Failed to load properties')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickEntry = (property: Property) => {
    setSelectedProperty(property)
    setBalance('')
    setNotes('')
    setEntryDialogOpen(true)
  }

  const handleSettings = (property: Property) => {
    setSelectedProperty(property)
    setThreshold(property.electricityMeterMinimumBalance?.toString() || '')
    setCurrentUnit(property.electricityMeterUnit || 'GHS')
    setSettingsDialogOpen(true)
  }

  const submitReading = async () => {
    if (!selectedProperty || !balance || parseFloat(balance) < 0) {
      toast.error('Please enter a valid balance')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/properties/${selectedProperty.id}/electricity-readings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            balance: parseFloat(balance),
            notes: notes || null,
          }),
        }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add reading')
      }

      toast.success('Reading added successfully')
      setEntryDialogOpen(false)
      setSelectedProperty(null)
      setBalance('')
      setNotes('')
      fetchProperties() // Refresh to get new reading
    } catch (error: any) {
      toast.error(error.message || 'Failed to add reading')
    } finally {
      setSubmitting(false)
    }
  }

  const submitSettings = async () => {
    if (!selectedProperty) return

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/properties/${selectedProperty.id}/electricity-threshold`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            minimumBalance: threshold ? parseFloat(threshold) : null,
            unit: currentUnit,
          }),
        }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update threshold')
      }

      toast.success('Settings updated successfully')
      setSettingsDialogOpen(false)
      setSelectedProperty(null)
      fetchProperties()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProperties = properties.filter((prop) => {
    if (statusFilter !== 'all' && prop.status !== statusFilter) {
      return false
    }
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        prop.name.toLowerCase().includes(searchLower) ||
        prop.nickname?.toLowerCase().includes(searchLower) ||
        prop.Owner.name.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const getAlertStatus = (property: Property) => {
    const reading = readings[property.id]
    if (!reading || !property.electricityMeterMinimumBalance) {
      return null
    }
    if (reading.balance < property.electricityMeterMinimumBalance) {
      return 'low'
    }
    return 'ok'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Electricity Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <TableSkeletonLoader rows={5} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Electricity Meter Readings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Property, owner..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Properties Table */}
          {filteredProperties.length === 0 ? (
            <EmptyState
              title="No properties found"
              description="No properties match your filters."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Last Reading</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties.map((property) => {
                  const reading = readings[property.id]
                  const alertStatus = getAlertStatus(property)
                  const unit = property.electricityMeterUnit || 'GHS'

                  return (
                    <TableRow key={property.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {property.nickname || property.name}
                            </div>
                            {property.nickname && (
                              <div className="text-xs text-gray-500">
                                {property.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{property.Owner.name}</TableCell>
                      <TableCell>
                        {reading ? (
                          <span className="font-medium">
                            {formatCurrency(reading.balance, unit as any)}
                          </span>
                        ) : (
                          <span className="text-gray-400">No reading</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {property.electricityMeterMinimumBalance !== null ? (
                          <span>
                            {formatCurrency(
                              property.electricityMeterMinimumBalance,
                              unit as any
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reading ? (
                          <div>
                            <div className="text-sm">
                              {format(new Date(reading.readingDate), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {reading.EnteredBy?.name || 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {alertStatus === 'low' ? (
                          <Badge variant="destructive" className="bg-red-100 text-red-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Low Balance
                          </Badge>
                        ) : alertStatus === 'ok' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="outline">No Alert</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickEntry(property)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Reading
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSettings(property)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Link href={`/admin/properties/${property.id}`}>
                            <Button size="sm" variant="ghost">
                              View
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Electricity Reading</DialogTitle>
            <DialogDescription>
              Enter the current balance for {selectedProperty?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="balance">
                Balance ({selectedProperty?.electricityMeterUnit || 'GHS'})
              </Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReading} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Reading'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Electricity Meter Settings</DialogTitle>
            <DialogDescription>
              Set the minimum balance threshold for {selectedProperty?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select value={currentUnit} onValueChange={setCurrentUnit}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHS">GHS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="threshold">
                Minimum Balance Threshold ({currentUnit})
              </Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Leave empty to disable alerts"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Alerts will be sent when balance falls below this amount
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitSettings} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

