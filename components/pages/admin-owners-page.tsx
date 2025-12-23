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
import { Plus, Edit, Eye, Users, Wallet, Building2, TrendingUp, CheckSquare, Square, Trash2, Download, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'
import { MetricCard } from '@/components/ui/metric-card'

interface Owner {
  id: string
  name: string
  email: string
  phoneNumber?: string
  preferredCurrency: Currency
  status: string
  OwnerWallet?: {
    currentBalance: number
  }
  Property: Array<{ id: string }>
}

export function AdminOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  useEffect(() => {
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      const data = await res.json()
      // Handle error response or ensure data is an array
      if (Array.isArray(data)) {
        setOwners(data)
      } else {
        console.error('API returned non-array:', data)
        setOwners([])
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
      setOwners([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedOwners.size === owners.length) {
      setSelectedOwners(new Set())
    } else {
      setSelectedOwners(new Set(owners.map(o => o.id)))
    }
  }

  const handleSelectOwner = (ownerId: string) => {
    const newSelected = new Set(selectedOwners)
    if (newSelected.has(ownerId)) {
      newSelected.delete(ownerId)
    } else {
      newSelected.add(ownerId)
    }
    setSelectedOwners(newSelected)
  }

  const handleBulkUpdateStatus = async (status: string) => {
    if (selectedOwners.size === 0) return
    if (!confirm(`Update ${selectedOwners.size} owner(s) to ${status}?`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/owners/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedOwners),
          action: 'updateStatus',
          data: { status },
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update owners')
      }
      toast.success('Bulk update successful', `Updated ${selectedOwners.size} owner(s)`)
      setSelectedOwners(new Set())
      fetchOwners()
    } catch (error: any) {
      toast.error('Bulk update failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOwners.size === 0) return
    if (!confirm(`Delete ${selectedOwners.size} owner(s)? This action cannot be undone.`)) return

    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/owners/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedOwners),
          action: 'delete',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete owners')
      }
      toast.success('Bulk delete successful', `Deleted ${selectedOwners.size} owner(s)`)
      setSelectedOwners(new Set())
      fetchOwners()
    } catch (error: any) {
      toast.error('Bulk delete failed', error.message)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedOwners.size === 0) return
    try {
      setBulkActionLoading(true)
      const res = await fetch('/api/owners/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedOwners),
          action: 'export',
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to export owners')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `owners-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export successful', `Exported ${selectedOwners.size} owner(s)`)
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
        <h1 className="text-2xl font-bold">Owners</h1>
        <Link href="/admin/owners/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Owner
          </Button>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Owners"
          value={owners.length}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Active Owners"
          value={owners.filter(o => o.status === 'active').length}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Properties"
          value={owners.reduce((sum, o) => sum + (o.Property?.length || 0), 0)}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Total Balances"
          value={formatCurrency(
            owners.reduce((sum, o) => sum + (o.OwnerWallet?.currentBalance || 0), 0),
            Currency.GHS
          )}
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {owners.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title="No owners yet"
          description="Get started by adding your first property owner to the system."
          action={{
            label: 'Add Owner',
            href: '/admin/owners/new',
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Owners</CardTitle>
              {selectedOwners.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedOwners.size} selected
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
                    onClick={() => setSelectedOwners(new Set())}
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
                      {selectedOwners.size === owners.length && owners.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((owner) => (
                <TableRow key={owner.id}>
                  <TableCell>
                    <button
                      onClick={() => handleSelectOwner(owner.id)}
                      className="flex items-center justify-center"
                    >
                      {selectedOwners.has(owner.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{owner.name}</TableCell>
                  <TableCell>{owner.email}</TableCell>
                  <TableCell>{owner.phoneNumber || '-'}</TableCell>
                  <TableCell>{owner.Property?.length || 0}</TableCell>
                  <TableCell>
                    {formatCurrency(
                      owner.OwnerWallet?.currentBalance || 0,
                      owner.preferredCurrency
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={owner.status === 'active' ? 'default' : 'secondary'}
                    >
                      {owner.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/admin/owners/${owner.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/owners/${owner.id}/edit`}>
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

