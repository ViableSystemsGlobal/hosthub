'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, Download, Loader2, Calendar, DollarSign, Receipt, TrendingUp, Package, Sparkles, Zap, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { exportAllReportsToPDF, exportReportToPDF } from '@/lib/reports/pdf-export'

type ReportType = 'bookings' | 'expenses' | 'revenue' | 'occupancy' | 'inventory' | 'cleaning-tasks' | 'check-in' | 'electricity' | 'all'

const allReportTypes: ReportType[] = [
  'bookings',
  'expenses',
  'revenue',
  'occupancy',
  'inventory',
  'cleaning-tasks',
  'check-in',
  'electricity',
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
  all: 'All Reports',
}

export function OwnerReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('all')
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [propertyId, setPropertyId] = useState<string>('all')
  const [properties, setProperties] = useState<Array<{ id: string; name: string; nickname: string | null }>>([])
  const [exporting, setExporting] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [allPreviewData, setAllPreviewData] = useState<Record<string, any> | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [grouping, setGrouping] = useState<'month' | 'property' | 'none'>('month')

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
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

      const reportTypeMap: Record<string, string> = {
        'bookings': 'BOOKINGS',
        'expenses': 'EXPENSES',
        'revenue': 'REVENUE',
        'occupancy': 'OCCUPANCY',
        'inventory': 'INVENTORY',
        'cleaning-tasks': 'CLEANING_TASKS',
        'check-in': 'CHECK_IN',
        'electricity': 'ELECTRICITY',
      }

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
        setPreviewData(null)
        setAllPreviewData(combined)
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
        await exportReportToPDF(reportType, previewData, startDate, endDate, propertyName)
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

      const reportTypeMap: Record<string, string> = {
        'bookings': 'BOOKINGS',
        'expenses': 'EXPENSES',
        'revenue': 'REVENUE',
        'occupancy': 'OCCUPANCY',
        'inventory': 'INVENTORY',
        'cleaning-tasks': 'CLEANING_TASKS',
        'check-in': 'CHECK_IN',
        'electricity': 'ELECTRICITY',
      }
      const reportTypeUpper = reportTypeMap[reportType] || 'BOOKINGS'
      
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        <p className="text-gray-600 mt-1">Generate and export reports for your properties</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>Select report type and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-9">
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
            </TabsList>

            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Label htmlFor="property">Property</Label>
                  <Select value={propertyId} onValueChange={setPropertyId}>
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
              </div>

              {(reportType === 'revenue' || reportType === 'occupancy') && (
                <div className="space-y-2">
                  <Label>Group By</Label>
                  <Select value={grouping} onValueChange={(v) => setGrouping(v as 'month' | 'property' | 'none')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="property">Property</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handlePreview} disabled={loadingPreview}>
                  {loadingPreview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Preview
                    </>
                  )}
                </Button>
                {(reportType === 'all' ? allPreviewData : previewData) && (
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    disabled={exporting}
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
                  variant="outline"
                  onClick={() => handleExport('EXCEL')}
                  disabled={exporting || reportType === 'all'}
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
                  variant="outline"
                  onClick={() => handleExport('CSV')}
                  disabled={exporting || reportType === 'all'}
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
            <CardDescription>Summary and first 10 rows of the report</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary */}
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
            
            {previewData.rows && previewData.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(previewData.rows[0]).map((key) => (
                        <th key={key} className="text-left p-2 font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.slice(0, 10).map((row: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        {Object.values(row).map((value: any, colIdx: number) => (
                          <td key={colIdx} className="p-2">
                            {value !== null && value !== undefined ? String(value) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.rows.length > 10 && (
                  <p className="text-sm text-gray-500 mt-4">
                    Showing first 10 of {previewData.rows.length} rows
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No data found for the selected filters</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Reports Preview */}
      {reportType === 'all' && allPreviewData && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Reports Preview</h2>
            <Button 
              variant="outline" 
              onClick={handleExportPDF}
              disabled={exporting}
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
          </div>
          {allReportTypes.map((rt) => {
            const data = allPreviewData[rt]
            if (!data || !data.rows || data.rows.length === 0) return null
            return (
              <Card key={rt} className="break-inside-avoid">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {rt.replace('-', ' ').replace(/\\b\\w/g, (c) => c.toUpperCase())}
                  </CardTitle>
                  {data.summary && <CardDescription>Summary and first 10 rows</CardDescription>}
                </CardHeader>
                <CardContent>
                  {data.summary && (
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(data.summary).map(([key, value]) => (
                        <div key={key} className={key === 'Note' ? 'col-span-2 md:col-span-4' : ''}>
                          <p className="text-xs text-gray-600">{key}</p>
                          <p className={`font-semibold ${key === 'Note' ? 'text-xs text-orange-600' : 'text-sm'}`}>
                            {String(value ?? '')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {Object.keys(data.rows[0]).map((key) => (
                            <th key={key} className="text-left p-2 font-medium">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.slice(0, 10).map((row: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            {Object.values(row).map((value: any, colIdx: number) => (
                              <td key={colIdx} className="p-2">
                                {value !== null && value !== undefined ? String(value) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.rows.length > 10 && (
                      <p className="text-sm text-gray-500 mt-4">
                        Showing first 10 of {data.rows.length} rows
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

