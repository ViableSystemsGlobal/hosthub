'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Eye, Building2, TrendingUp, DollarSign, CheckSquare, Square, Trash2, Download, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Currency } from '@prisma/client'
import { MetricCard } from '@/components/ui/metric-card'

interface Property {
  id: string
  name: string
  nickname?: string
  city?: string
  currency: Currency
  defaultCommissionRate: number
  status: string
  Owner: {
    id: string
    name: string
  }
  manager?: {
    id: string
    name: string | null
    email: string
  } | null
}

export function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  useEffect(() => {
    fetchProperties()
    
    // Refetch when page becomes visible (e.g., after navigating back from edit)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProperties()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      if (!res.ok) {
        // If unauthorized, redirect to login
        if (res.status === 401 || res.status === 403) {
          window.location.href = '/auth/login'
          return
        }
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch properties' }))
        throw new Error(errorData.error || 'Failed to fetch properties')
      }
      const data = await res.json()
      // Ensure data is an array
      if (Array.isArray(data)) {
        setProperties(data)
      } else if (data.error) {
        console.error('API error:', data.error)
        setProperties([])
      } else {
        setProperties([])
      }
    } catch (error: any) {
      // Handle redirect errors
      if (error.message?.includes('NEXT_REDIRECT') || error.message?.includes('redirect')) {
        window.location.href = '/auth/login'
        return
      }
      console.error('Failed to fetch properties:', error)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedProperties.size === properties.length) {
      setSelectedProperties(new Set())
    } else {
      setSelectedProperties(new Set(properties.map(p => p.id)))
    }
  }

  const handleSelectProperty = (propertyId: string) => {
    const newSelected = new Set(selectedProperties)
    if (newSelected.has(propertyId)) {
      newSelected.delete(propertyId)
    } else {
      newSelected.add(propertyId)
    }
    setSelectedProperties(newSelected)
  }

  const handleBulkUpdateStatus = async (status: string) => {
    if (selectedProperties.size === 0) return
    if (!confirm(`Update ${selectedProperties.size} property(ies) to ${status}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/properties/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedProperties),
          action: 'updateStatus',
          data: { status },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update properties')
      }
      toast.success('Bulk update successful', `Updated ${selectedProperties.size} property(ies)`)
      setSelectedProperties(new Set())
      fetchProperties()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedProperties.size === 0) return
    if (!confirm(`Delete ${selectedProperties.size} property(ies)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/properties/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedProperties),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete properties')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedProperties.size} property(ies)`)
      setSelectedProperties(new Set())
      fetchProperties()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedProperties.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/properties/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedProperties),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export properties')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `properties-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedProperties.size} property(ies)`)
    } catch (error: any) {
      toast.error('Bulk export failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Properties</h1>
        <Link href="/admin/properties/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Properties"
          value={Array.isArray(properties) ? properties.length : 0}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Active Properties"
          value={Array.isArray(properties) ? properties.filter(p => p.status === 'active').length : 0}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Inactive Properties"
          value={Array.isArray(properties) ? properties.filter(p => p.status === 'inactive').length : 0}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Avg Commission"
          value={
            Array.isArray(properties) && properties.length > 0
              ? `${(properties.reduce((sum, p) => sum + p.defaultCommissionRate, 0) / properties.length * 100).toFixed(1)}%`
              : '0%'
          }
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {!Array.isArray(properties) || properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="No properties yet"
          description="Get started by adding your first property to the system."
          action={{
            label: 'Add Property',
            href: '/admin/properties/new',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Properties</CardTitle>
              {selectedProperties.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedProperties.size} selected
                  </span>
                  <Select
                    onValueChange={(value) => handleBulkUpdateStatus(value)}
                    disabled={bulkActionLoading}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Set to Active</SelectItem>
                      <SelectItem value="inactive">Set to Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkExport}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    {bulkActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProperties(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {selectedProperties.size === properties.length && properties.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <button
                        onClick={() => handleSelectProperty(property.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedProperties.has(property.id) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {property.nickname || property.name}
                    </TableCell>
                    <TableCell>{property.Owner.name}</TableCell>
                    <TableCell>{property.manager?.name || property.manager?.email || '-'}</TableCell>
                    <TableCell>{property.city || '-'}</TableCell>
                    <TableCell>{property.currency}</TableCell>
                    <TableCell>{(property.defaultCommissionRate * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Badge
                        variant={property.status === 'active' ? 'default' : 'secondary'}
                      >
                        {property.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/admin/properties/${property.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/properties/${property.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

