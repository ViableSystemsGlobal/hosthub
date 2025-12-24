'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Zap, Plus, Settings, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/currency'

interface ElectricityMeterProps {
  propertyId: string
  minimumBalance?: number | null
  unit?: string | null
  canEdit?: boolean
}

export function ElectricityMeter({
  propertyId,
  minimumBalance,
  unit = 'GHS',
  canEdit = false,
}: ElectricityMeterProps) {
  const [readings, setReadings] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [balance, setBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [threshold, setThreshold] = useState(minimumBalance?.toString() || '')
  const [currentUnit, setCurrentUnit] = useState(unit || 'GHS')

  useEffect(() => {
    fetchReadings()
    fetchAlerts()
  }, [propertyId])

  const fetchReadings = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/electricity-readings`)
      if (res.ok) {
        const data = await res.json()
        setReadings(data)
      }
    } catch (error) {
      console.error('Failed to fetch readings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/electricity-alerts`)
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.filter((a: any) => !a.resolvedAt))
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    }
  }

  const handleAddReading = async () => {
    if (!balance || parseFloat(balance) < 0) {
      toast.error('Please enter a valid balance')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/electricity-readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: parseFloat(balance),
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add reading')
      }

      toast.success('Reading added successfully')
      setAddDialogOpen(false)
      setBalance('')
      setNotes('')
      fetchReadings()
      fetchAlerts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add reading')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateThreshold = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/electricity-threshold`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minimumBalance: threshold ? parseFloat(threshold) : null,
          unit: currentUnit,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update threshold')
      }

      toast.success('Threshold updated successfully')
      setSettingsDialogOpen(false)
      fetchReadings()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update threshold')
    } finally {
      setSubmitting(false)
    }
  }

  const latestReading = readings[0]
  const isLowBalance =
    latestReading &&
    minimumBalance !== null &&
    minimumBalance !== undefined &&
    latestReading.balance < minimumBalance

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Electricity Meter
        </CardTitle>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reading
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLowBalance && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Low Balance Alert</p>
              <p className="text-xs text-red-700">
                Current balance ({formatCurrency(latestReading.balance, currentUnit as any)}) is below
                threshold ({formatCurrency(minimumBalance!, currentUnit as any)})
              </p>
            </div>
          </div>
        )}

        {latestReading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="text-2xl font-bold">
                {formatCurrency(latestReading.balance, currentUnit as any)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Reading</span>
              <span>{format(new Date(latestReading.readingDate), 'MMM dd, yyyy HH:mm')}</span>
            </div>
            {minimumBalance !== null && minimumBalance !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minimum Threshold</span>
                <span>{formatCurrency(minimumBalance, currentUnit as any)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No readings yet</p>
        )}

        {readings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Readings</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Entered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readings.slice(0, 5).map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>
                      {format(new Date(reading.readingDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(reading.balance, currentUnit as any)}
                    </TableCell>
                    <TableCell>
                      {reading.EnteredBy?.name || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add Reading Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Electricity Reading</DialogTitle>
            <DialogDescription>
              Enter the current balance remaining on the prepaid meter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="balance">Balance ({currentUnit})</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
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
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddReading} disabled={submitting}>
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
              Set the minimum balance threshold for alerts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <Label htmlFor="threshold">Minimum Balance Threshold ({currentUnit})</Label>
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
            <Button onClick={handleUpdateThreshold} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

