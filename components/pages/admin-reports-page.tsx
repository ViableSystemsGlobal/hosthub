'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Download, Loader2, Calendar, DollarSign, Receipt, TrendingUp, Mail, Plus, Edit, Trash2, Eye, Clock, CheckCircle, XCircle, Package, Sparkles, Zap, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { exportAllReportsToPDF, exportReportToPDF } from '@/lib/reports/pdf-export'

type ReportType = 'bookings' | 'expenses' | 'revenue' | 'occupancy' | 'inventory' | 'cleaning-tasks' | 'check-in' | 'electricity' | 'issues' | 'all'
type ExportFormat = 'csv' | 'pdf'

const allReportTypes: ReportType[] = [
  'bookings',
  'expenses',
  'revenue',
  'occupancy',
  'inventory',
  'cleaning-tasks',
  'check-in',
  'electricity',
  'issues',
]

const reportLabels: Record<ReportType, string> = {
  bookings: 'Bookings',
  expenses: 'Expenses',
  revenue: 'Revenue',
  occupancy: 'Occupancy',
  inventory: 'Inventory',
  'cleaning-tasks': 'Cleaning Tasks',
  'check-in': 'Check-In',
  electricity: 'Electricity',
  issues: 'Issues',
  all: 'All Reports',
}

export function AdminReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('all')
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [propertyId, setPropertyId] = useState<string>('all')
  const [ownerId, setOwnerId] = useState<string>('all')
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([])
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([])
  const [exporting, setExporting] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [allPreviewData, setAllPreviewData] = useState<Record<string, any> | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [grouping, setGrouping] = useState<'month' | 'property' | 'owner' | 'none'>('month')

  useEffect(() => {
    fetchProperties()
    fetchOwners()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      if (res.ok) {
        const data = await res.json()
        setOwners(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const handlePreview = async () => {
    try {
      setLoadingPreview(true)
      
      const filters: any = {
        dateFrom: startDate,
        dateTo: endDate,
      }

      if (propertyId !== 'all') {
        filters.propertyIds = [propertyId]
      }
      if (ownerId !== 'all') {
        filters.ownerIds = [ownerId]
      }

      const reportTypeMap: Record<string, string> = {
        'bookings': 'BOOKINGS',
        'expenses': 'EXPENSES',
        'revenue': 'REVENUE',
        'occupancy': 'OCCUPANCY',
        'inventory': 'INVENTORY',
        'cleaning-tasks': 'CLEANING_TASKS',
        'check-in': 'CHECK_IN',
        'electricity': 'ELECTRICITY',
        'issues': 'ISSUES',
      }

      // Handle "All" by combining previews for every type
      if (reportType === 'all') {
        const combined: Record<string, any> = {}
        for (const rt of allReportTypes) {
          const rtKey = reportTypeMap[rt]
          if (!rtKey) continue
          const res = await fetch('/api/reports/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              type: rtKey,
              filters,
              grouping: (rt === 'revenue' || rt === 'occupancy') ? grouping : undefined,
            }),
          })
          if (!res.ok) {
            const error = await res.json().catch(() => ({}))
            throw new Error(error.error || `Failed to generate ${rt} report`)
          }
          const data = await res.json()
          combined[rt] = data?.data
        }
        setAllPreviewData(combined)
        setPreviewData(null)
      } else {
        const reportTypeUpper = reportTypeMap[reportType] || 'BOOKINGS'
        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: reportTypeUpper,
            filters,
            grouping: (reportType === 'revenue' || reportType === 'occupancy') ? grouping : undefined,
          }),
        })
        
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to generate preview')
        }

        const data = await res.json()
        setPreviewData(data.data)
        setAllPreviewData(null)
      }
      toast.success('Preview generated', 'Scroll down to see the report preview')
    } catch (error: any) {
      console.error('Preview error:', error)
      toast.error('Preview failed', error.message)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleExportPDF = async () => {
    try {
      setExporting(true)
      
      if (reportType === 'all') {
        if (!allPreviewData) {
          toast.error('No data available', 'Please generate a preview first')
          return
        }
        await exportAllReportsToPDF(allPreviewData, startDate, endDate)
        toast.success('PDF exported', 'Your combined reports PDF has been downloaded')
      } else {
        if (!previewData) {
          toast.error('No data available', 'Please generate a preview first')
          return
        }
        const propertyName = propertyId !== 'all' 
          ? properties.find(p => p.id === propertyId)?.name 
          : undefined
        const ownerName = ownerId !== 'all'
          ? owners.find(o => o.id === ownerId)?.name
          : undefined
        await exportReportToPDF(reportType, previewData, startDate, endDate, propertyName, ownerName)
        toast.success('PDF exported', 'Your report PDF has been downloaded')
      }
    } catch (error: any) {
      console.error('PDF export error:', error)
      toast.error('PDF export failed', error.message || 'Failed to generate PDF')
    } finally {
      setExporting(false)
    }
  }

  const handleExport = async (exportFormat: 'EXCEL' | 'CSV') => {
    try {
      setExporting(true)
      if (reportType === 'all') {
        toast.error('Export for All is not supported. Use "Export to PDF" instead.')
        setExporting(false)
        return
      }
      
      const filters: any = {
        dateFrom: startDate,
        dateTo: endDate,
      }

      if (propertyId !== 'all') {
        filters.propertyIds = [propertyId]
      }
      if (ownerId !== 'all') {
        filters.ownerIds = [ownerId]
      }

      const reportTypeMap: Record<string, string> = {
        'bookings': 'BOOKINGS',
        'expenses': 'EXPENSES',
        'revenue': 'REVENUE',
        'occupancy': 'OCCUPANCY',
        'inventory': 'INVENTORY',
        'cleaning-tasks': 'CLEANING_TASKS',
        'check-in': 'CHECK_IN',
        'electricity': 'ELECTRICITY',
        'issues': 'ISSUES',
      }
      const reportTypeUpper = reportTypeMap[reportType] || 'BOOKINGS'
      
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportTypeUpper,
          format: exportFormat,
          filters,
          grouping: (reportType === 'revenue' || reportType === 'occupancy') ? grouping : undefined,
          filename: `report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}`,
        }),
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export report')
      }

      // Handle file download
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const contentDisposition = res.headers.get('content-disposition')
      let filename = `report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat.toLowerCase()}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Report exported', `Your ${reportType} report has been downloaded`)
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error('Export failed', error.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Exports</h1>
        <p className="text-gray-600 mt-1">Generate and export reports for bookings, expenses, and revenue</p>
      </div>

      <Tabs defaultValue="quick" className="space-y-6">
        <TabsList>
          <TabsTrigger value="quick">Quick Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>Select report type and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-10">
              <TabsTrigger value="all">
                <Sparkles className="w-4 h-4 mr-2" />
                All
              </TabsTrigger>
              <TabsTrigger value="bookings">
                <Calendar className="w-4 h-4 mr-2" />
                Bookings
              </TabsTrigger>
              <TabsTrigger value="expenses">
                <Receipt className="w-4 h-4 mr-2" />
                Expenses
              </TabsTrigger>
              <TabsTrigger value="revenue">
                <DollarSign className="w-4 h-4 mr-2" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="occupancy">
                <TrendingUp className="w-4 h-4 mr-2" />
                Occupancy
              </TabsTrigger>
              <TabsTrigger value="inventory">
                <Package className="w-4 h-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="cleaning-tasks">
                <Sparkles className="w-4 h-4 mr-2" />
                Cleaning
              </TabsTrigger>
              <TabsTrigger value="check-in">
                <CheckCircle className="w-4 h-4 mr-2" />
                Check-In
              </TabsTrigger>
              <TabsTrigger value="electricity">
                <Zap className="w-4 h-4 mr-2" />
                Electricity
              </TabsTrigger>
              <TabsTrigger value="issues">
                <AlertCircle className="w-4 h-4 mr-2" />
                Issues
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bookings" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Export all bookings with details including guest names, dates, amounts, and status.
              </div>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Export all expenses with categories, amounts, dates, and linked properties.
              </div>
            </TabsContent>

            <TabsContent value="revenue" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Generate revenue summary report with totals, breakdowns, and trends.
              </div>
              <div className="space-y-2">
                <Label>Group By</Label>
                <Select value={grouping} onValueChange={(v) => setGrouping(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">By Month</SelectItem>
                    <SelectItem value="property">By Property</SelectItem>
                    <SelectItem value="owner">By Owner</SelectItem>
                    <SelectItem value="none">No Grouping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="occupancy" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Generate occupancy report showing booking rates and availability.
              </div>
              <div className="space-y-2">
                <Label>Group By</Label>
                <Select value={grouping} onValueChange={(v) => setGrouping(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">By Month</SelectItem>
                    <SelectItem value="property">By Property</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Export inventory items with quantities, stock levels, and status. Filter by type or show only low stock items.
              </div>
            </TabsContent>

            <TabsContent value="cleaning-tasks" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Generate cleaning task reports with completion rates, timeliness, and quality metrics.
              </div>
            </TabsContent>

            <TabsContent value="check-in" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Export guest check-in records with timestamps, property details, and check-in notes.
              </div>
            </TabsContent>

            <TabsContent value="electricity" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Generate electricity meter reading reports with consumption trends and balance tracking.
              </div>
            </TabsContent>

            <TabsContent value="issues" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600">
                Export property issues with status, priority, assignment details, and resolution information.
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
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
              <Label htmlFor="property">Property (Optional)</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger id="property">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Owner (Optional)</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger id="owner">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handlePreview}
              disabled={loadingPreview}
              variant="outline"
              className="flex-1"
            >
              {loadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Preview Report
                </>
              )}
            </Button>
            {(reportType === 'all' ? allPreviewData : previewData) && (
              <Button 
                variant="outline" 
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex-1"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export to PDF
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => handleExport('EXCEL')}
              disabled={exporting || reportType === 'all'}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </>
              )}
            </Button>
            <Button
              onClick={() => handleExport('CSV')}
              disabled={exporting || reportType === 'all'}
              variant="outline"
              className="flex-1"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg mt-4">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Use "Preview Report" to see the data before exporting. 
              Excel exports include a summary sheet with key metrics.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
            <CardDescription>Preview of your report data (showing first 50 rows)</CardDescription>
          </CardHeader>
          <CardContent>
            {previewData.summary && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(previewData.summary).map(([key, value]) => (
                    <div key={key} className={key === 'Note' ? 'col-span-2 md:col-span-4' : ''}>
                      <p className="text-sm text-gray-600">{key}</p>
                      <p className={`font-semibold ${key === 'Note' ? 'text-sm text-orange-600' : 'text-lg'}`}>
                        {String(value ?? '')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    {previewData.headers.map((header: string, index: number) => (
                      <th key={index} className="text-left p-2 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={previewData.headers.length} className="text-center p-8 text-gray-500">
                        No data found for the selected filters
                      </td>
                    </tr>
                  ) : (
                    previewData.rows.slice(0, 50).map((row: any[], rowIndex: number) => (
                      <tr key={rowIndex} className="border-b hover:bg-gray-50">
                        {row.map((cell: any, cellIndex: number) => (
                          <td key={cellIndex} className="p-2 text-sm">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {previewData.rows.length > 50 && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Showing first 50 rows of {previewData.rows.length} total rows. Export to see all data.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'all' && allPreviewData && (
        <div className="space-y-6">
          {allReportTypes.map((rt) => {
            const data = allPreviewData[rt]
            if (!data?.rows || !data.headers) return null
            const rows = Array.isArray(data.rows) ? data.rows : []
            const headers = Array.isArray(data.headers) ? data.headers : []
            return (
              <Card key={rt}>
                <CardHeader>
                  <CardTitle>{reportLabels[rt]}</CardTitle>
                  <CardDescription>Preview of {reportLabels[rt]} (first 50 rows)</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.summary && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-3">Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(data.summary).map(([key, value]) => (
                          <div key={key} className={key === 'Note' ? 'col-span-2 md:col-span-4' : ''}>
                            <p className="text-sm text-gray-600">{key}</p>
                            <p className={`font-semibold ${key === 'Note' ? 'text-sm text-orange-600' : 'text-lg'}`}>
                              {String(value ?? '')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          {headers.map((header: string, index: number) => (
                            <th key={index} className="text-left p-2 font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={headers.length} className="text-center p-8 text-gray-500">
                              No data found for the selected filters
                            </td>
                          </tr>
                        ) : (
                          rows.slice(0, 50).map((row: any[], rowIndex: number) => (
                            <tr key={rowIndex} className="border-b hover:bg-gray-50">
                              {row.map((cell: any, cellIndex: number) => (
                                <td key={cellIndex} className="p-2 text-sm">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {rows.length > 50 && (
                      <p className="text-sm text-gray-500 mt-4 text-center">
                        Showing first 50 rows of {rows.length} total rows. Export to see all data.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="scheduled">
          <ScheduledReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Scheduled Reports Tab Component
function ScheduledReportsTab() {
  const [scheduledReports, setScheduledReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<any>(null)
  const [previewReport, setPreviewReport] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([])
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule: 'DAILY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'NONE',
    scheduleDay: 0,
    scheduleTime: '08:00',
    emailRecipients: [] as string[],
    emailRecipientsText: '',
    propertyIds: [] as string[],
    ownerIds: [] as string[],
    isActive: true,
  })

  useEffect(() => {
    fetchScheduledReports()
    fetchProperties()
    fetchOwners()
  }, [])

  const fetchScheduledReports = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/reports?type=CUSTOM')
      if (res.ok) {
        const data = await res.json()
        setScheduledReports(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error)
      toast.error('Failed to load reports', 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      if (res.ok) {
        const data = await res.json()
        setOwners(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const handleOpenDialog = (report?: any) => {
    if (report) {
      setEditingReport(report)
      setFormData({
        name: report.name || '',
        description: report.description || '',
        schedule: report.schedule || 'DAILY',
        scheduleDay: report.scheduleDay || 0,
        scheduleTime: report.scheduleTime || '08:00',
        emailRecipients: report.emailRecipients || [],
        emailRecipientsText: (report.emailRecipients || []).join(', '),
        propertyIds: (report.filters?.propertyIds as string[]) || [],
        ownerIds: (report.filters?.ownerIds as string[]) || [],
        isActive: report.isActive !== false,
      })
    } else {
      setEditingReport(null)
      setFormData({
        name: '',
        description: '',
        schedule: 'DAILY',
        scheduleDay: 0,
        scheduleTime: '08:00',
        emailRecipients: [],
        emailRecipientsText: '',
        propertyIds: [],
        ownerIds: [],
        isActive: true,
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const emailRecipients = formData.emailRecipientsText
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)

      if (!formData.name) {
        toast.error('Name required', 'Please enter a report name')
        return
      }

      if (emailRecipients.length === 0) {
        toast.error('Recipients required', 'Please enter at least one email address')
        return
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        type: 'CUSTOM',
        format: 'EXCEL',
        schedule: formData.schedule,
        scheduleDay: formData.schedule === 'WEEKLY' || formData.schedule === 'MONTHLY' ? formData.scheduleDay : null,
        scheduleTime: formData.scheduleTime,
        filters: {
          propertyIds: formData.propertyIds.length > 0 ? formData.propertyIds : undefined,
          ownerIds: formData.ownerIds.length > 0 ? formData.ownerIds : undefined,
        },
        emailRecipients,
        isActive: formData.isActive,
      }

      const url = editingReport ? `/api/reports/${editingReport.id}` : '/api/reports'
      const method = editingReport ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save report')
      }

      toast.success('Report saved', editingReport ? 'Report updated successfully' : 'Report created successfully')
      setDialogOpen(false)
      fetchScheduledReports()
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error('Save failed', error.message)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return
    }

    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete report')
      }

      toast.success('Report deleted', 'Scheduled report has been removed')
      fetchScheduledReports()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error('Delete failed', error.message)
    }
  }

  const handleToggleActive = async (report: any) => {
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !report.isActive }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update report')
      }

      toast.success('Report updated', `Report ${!report.isActive ? 'activated' : 'deactivated'}`)
      fetchScheduledReports()
    } catch (error: any) {
      console.error('Toggle error:', error)
      toast.error('Update failed', error.message)
    }
  }

  const handlePreview = async (reportId: string) => {
    try {
      setPreviewLoading(true)
      const res = await fetch(`/api/reports/${reportId}/preview`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to preview report')
      }
      const data = await res.json()
      setPreviewReport(data)
    } catch (error: any) {
      console.error('Preview error:', error)
      toast.error('Preview failed', error.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const getScheduleLabel = (schedule: string, scheduleDay: number | null, scheduleTime: string | null) => {
    const time = scheduleTime || '08:00'
    switch (schedule) {
      case 'DAILY':
        return `Daily at ${time}`
      case 'WEEKLY':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return `Weekly on ${days[scheduleDay || 0]} at ${time}`
      case 'MONTHLY':
        return `Monthly on day ${scheduleDay || 1} at ${time}`
      default:
        return 'Not scheduled'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Newsletter Reports</CardTitle>
              <CardDescription>
                Schedule AI-generated newsletter reports delivered via email (Morning Brew style)
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              New Scheduled Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : scheduledReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No scheduled reports yet</p>
              <p className="text-sm mt-2">Create your first AI newsletter report</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sent</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>
                      {getScheduleLabel(report.schedule, report.scheduleDay, report.scheduleTime)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {(report.emailRecipients || []).slice(0, 2).map((email: string, idx: number) => (
                          <span key={idx} className="text-sm text-gray-600">
                            {email}
                          </span>
                        ))}
                        {(report.emailRecipients || []).length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{(report.emailRecipients || []).length - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.isActive ? 'default' : 'secondary'}>
                        {report.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.lastGeneratedAt
                        ? format(new Date(report.lastGeneratedAt), 'MMM dd, yyyy HH:mm')
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {report.nextRunAt
                        ? format(new Date(report.nextRunAt), 'MMM dd, yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(report.id)}
                          disabled={previewLoading}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(report)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Switch
                          checked={report.isActive}
                          onCheckedChange={() => handleToggleActive(report)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReport ? 'Edit Scheduled Report' : 'New Scheduled Report'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Report Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Business Summary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule *</Label>
                <Select
                  value={formData.schedule}
                  onValueChange={(v: any) => setFormData({ ...formData, schedule: v })}
                >
                  <SelectTrigger id="schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.schedule === 'WEEKLY' && (
                <div className="space-y-2">
                  <Label htmlFor="scheduleDay">Day of Week *</Label>
                  <Select
                    value={formData.scheduleDay.toString()}
                    onValueChange={(v) => setFormData({ ...formData, scheduleDay: parseInt(v) })}
                  >
                    <SelectTrigger id="scheduleDay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.schedule === 'MONTHLY' && (
                <div className="space-y-2">
                  <Label htmlFor="scheduleDay">Day of Month *</Label>
                  <Input
                    id="scheduleDay"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.scheduleDay}
                    onChange={(e) => setFormData({ ...formData, scheduleDay: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="scheduleTime">Time *</Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={formData.scheduleTime}
                  onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailRecipients">Email Recipients *</Label>
              <Textarea
                id="emailRecipients"
                value={formData.emailRecipientsText}
                onChange={(e) => setFormData({ ...formData, emailRecipientsText: e.target.value })}
                placeholder="Enter email addresses separated by commas"
                rows={3}
              />
              <p className="text-xs text-gray-500">Separate multiple emails with commas</p>
            </div>

            <div className="space-y-2">
              <Label>Filters (Optional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="properties">Properties</Label>
                  <Select
                    value={formData.propertyIds.length > 0 ? formData.propertyIds[0] : 'all'}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        propertyIds: v === 'all' ? [] : [v],
                      })
                    }
                  >
                    <SelectTrigger id="properties">
                      <SelectValue placeholder="All Properties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((prop) => (
                        <SelectItem key={prop.id} value={prop.id}>
                          {prop.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owners">Owners</Label>
                  <Select
                    value={formData.ownerIds.length > 0 ? formData.ownerIds[0] : 'all'}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        ownerIds: v === 'all' ? [] : [v],
                      })
                    }
                  >
                    <SelectTrigger id="owners">
                      <SelectValue placeholder="All Owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Owners</SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">
                  {editingReport ? 'Update' : 'Create'} Report
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewReport && (
        <Dialog open={!!previewReport} onOpenChange={() => setPreviewReport(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{previewReport.subject}</h3>
              </div>
              <div className="prose max-w-none">
                <p className="text-lg font-medium">{previewReport.greeting}</p>
                <p>{previewReport.intro}</p>
                {previewReport.sections.map((section: any, idx: number) => (
                  <div key={idx} className="mt-6">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                      {section.emoji && <span>{section.emoji}</span>}
                      {section.title}
                    </h4>
                    <p className="mt-2 whitespace-pre-wrap">{section.content}</p>
                  </div>
                ))}
                {previewReport.highlights.length > 0 && (
                  <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Quick Highlights</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {previewReport.highlights.map((h: string, idx: number) => (
                        <li key={idx}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-6">{previewReport.closing}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

