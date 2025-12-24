'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { BookingSource } from '@prisma/client'
import { format } from 'date-fns'

interface ImportPreview {
  preview: boolean
  total: number
  valid: number
  invalid: number
  duplicateCount: number
  toImport: number
  invalidBookings: Array<{ row: number; errors: string[] }>
  duplicates: Array<{ externalReservationCode?: string; checkInDate: Date }>
  sample: Array<{
    guestName?: string
    checkInDate: Date
    checkOutDate: Date
    baseAmount: number
    currency: string
    source: string
  }>
}

interface ImportResult {
  success: boolean
  imported: number
  failedCount: number
  skipped: number
  invalid: number
  total: number
  created: Array<{ id: string; guestName?: string; checkInDate: Date }>
  failed: Array<{ guestName?: string; checkInDate: Date; error: string }>
}

interface CSVImportDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CSVImportDialog({ open, onClose, onSuccess }: CSVImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')
  const [defaultSource, setDefaultSource] = useState<BookingSource>(BookingSource.OTHER)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  // Fetch properties when dialog opens
  useEffect(() => {
    if (open) {
      fetchProperties()
    }
  }, [open])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      setProperties(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setFile(selectedFile)
    }
  }

  const handlePreview = async () => {
    if (!file || !selectedPropertyId || !selectedOwnerId) {
      toast.error('Please select a file, property, and owner')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('propertyId', selectedPropertyId)
      formData.append('ownerId', selectedOwnerId)
      formData.append('defaultSource', defaultSource)
      formData.append('skipDuplicates', skipDuplicates.toString())
      formData.append('preview', 'true')

      const res = await fetch('/api/bookings/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to preview CSV')
      }

      const data = await res.json()
      setPreview(data)
      setStep('preview')
    } catch (error: any) {
      toast.error(error.message || 'Failed to preview CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !selectedPropertyId || !selectedOwnerId) {
      toast.error('Please select a file, property, and owner')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('propertyId', selectedPropertyId)
      formData.append('ownerId', selectedOwnerId)
      formData.append('defaultSource', defaultSource)
      formData.append('skipDuplicates', skipDuplicates.toString())
      formData.append('preview', 'false')

      const res = await fetch('/api/bookings/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to import CSV')
      }

      const data = await res.json()
      setResult(data)
      setStep('result')
      
      if (data.imported > 0) {
        toast.success(`Successfully imported ${data.imported} booking(s)`)
        onSuccess?.()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('upload')
    setFile(null)
    setSelectedPropertyId('')
    setSelectedOwnerId('')
    setPreview(null)
    setResult(null)
    onClose()
  }

  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Bookings from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import bookings in bulk. Supported formats: Airbnb, Booking.com, or generic CSV.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>CSV File</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="flex-1"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
            </div>

            {/* Property Selection */}
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select 
                value={selectedPropertyId} 
                onValueChange={(value) => {
                  setSelectedPropertyId(value)
                  const prop = properties.find(p => p.id === value)
                  if (prop && prop.ownerId) {
                    setSelectedOwnerId(prop.ownerId)
                  }
                }}
              >
                <SelectTrigger>
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
              {selectedProperty && (
                <p className="text-xs text-muted-foreground">
                  Owner: {selectedProperty.Owner?.name || 'Unknown'}
                </p>
              )}
            </div>

            {/* Owner is auto-set from property, but show it */}
            {selectedProperty && (
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input
                  value={selectedProperty.Owner?.name || selectedProperty.ownerId}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            )}

            {/* Default Source */}
            <div className="space-y-2">
              <Label>Default Booking Source</Label>
              <Select value={defaultSource} onValueChange={(v) => setDefaultSource(v as BookingSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BookingSource.AIRBNB}>Airbnb</SelectItem>
                  <SelectItem value={BookingSource.BOOKING_COM}>Booking.com</SelectItem>
                  <SelectItem value={BookingSource.INSTAGRAM}>Instagram</SelectItem>
                  <SelectItem value={BookingSource.DIRECT}>Direct</SelectItem>
                  <SelectItem value={BookingSource.OTHER}>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skipDuplicates"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="skipDuplicates" className="cursor-pointer">
                Skip duplicate bookings (based on reservation code)
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={!file || !selectedPropertyId || loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Preview Import
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{preview.total}</div>
                  <div className="text-xs text-muted-foreground">Total Rows</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{preview.valid}</div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-600">{preview.duplicateCount}</div>
                  <div className="text-xs text-muted-foreground">Duplicates</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">{preview.invalid}</div>
                  <div className="text-xs text-muted-foreground">Invalid</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">{preview.toImport}</div>
                  <div className="text-xs text-muted-foreground">To Import</div>
                </CardContent>
              </Card>
            </div>

            {/* Sample Data */}
            {preview.sample.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Sample Bookings (first 5)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sample.map((booking, index) => (
                      <TableRow key={index}>
                        <TableCell>{booking.guestName || '-'}</TableCell>
                        <TableCell>{format(new Date(booking.checkInDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(booking.checkOutDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          {booking.currency} {booking.baseAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>{booking.source}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Invalid Bookings */}
            {preview.invalidBookings.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-red-600">Invalid Rows</h3>
                <div className="max-h-40 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.invalidBookings.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell className="text-red-600 text-sm">
                            {item.errors.join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={preview.toImport === 0 || loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {preview.toImport} Booking(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                      <div className="text-xs text-muted-foreground">Imported</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <div className="text-2xl font-bold text-red-600">{result.failedCount}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-orange-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{result.skipped}</div>
                      <div className="text-xs text-muted-foreground">Skipped</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{result.invalid}</div>
                  <div className="text-xs text-muted-foreground">Invalid</div>
                </CardContent>
              </Card>
            </div>

            {/* Failed Imports */}
            {result.failedCount > 0 && result.failed.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-red-600">Failed Imports</h3>
                <div className="max-h-40 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.failed.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.guestName || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(item.checkInDate), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="text-red-600 text-sm">{item.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

