'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Package, Search, Building2, AlertTriangle, Loader2, Edit } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { EmptyState } from '@/components/ui/empty-state'
import { InventoryType } from '@prisma/client'

interface InventoryItem {
  id: string
  name: string
  type: InventoryType
  description?: string | null
  quantity?: number | null
  minimumQuantity?: number | null
  unit?: string | null
  Property: {
    id: string
    name: string
    nickname?: string | null
  }
  lastCheckedAt?: string | null
}

export function AdminInventoryEntryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('CONSUMABLE')
  const [properties, setProperties] = useState<any[]>([])

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    if (properties.length > 0 || propertyFilter !== 'all') {
      fetchInventory()
    }
  }, [propertyFilter, typeFilter, properties.length])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', { credentials: 'include' })
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchInventory = async () => {
    try {
      setLoading(true)
      
      // Fetch inventory from all properties or filtered property
      let allInventory: InventoryItem[] = []
      
      if (propertyFilter === 'all') {
        // Fetch from all properties the user has access to
        const propertyIds = properties.map(p => p.id)
        
        if (propertyIds.length === 0) {
          setInventory([])
          setLoading(false)
          return
        }

        // Fetch inventory from all properties in parallel
        const inventoryPromises = propertyIds.map(async (propertyId) => {
          try {
            const res = await fetch(`/api/properties/${propertyId}/inventory?type=${typeFilter}`, {
              credentials: 'include',
            })
            if (res.ok) {
              const data = await res.json()
              return Array.isArray(data) ? data : []
            }
            return []
          } catch (error) {
            console.error(`Failed to fetch inventory for property ${propertyId}:`, error)
            return []
          }
        })

        const results = await Promise.all(inventoryPromises)
        allInventory = results.flat()
      } else {
        const res = await fetch(`/api/properties/${propertyFilter}/inventory?type=${typeFilter}`, {
          credentials: 'include',
        })
        
        if (res.status === 401 || res.status === 403) {
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login'
          }
          return
        }

        if (res.ok) {
          const data = await res.json()
          allInventory = Array.isArray(data) ? data : []
        } else {
          const error = await res.json().catch(() => ({ error: res.statusText }))
          throw new Error(error.error || 'Failed to fetch inventory')
        }
      }

      setInventory(allInventory)
    } catch (error: any) {
      console.error('Failed to fetch inventory:', error)
      toast.error(error.message || 'Failed to load inventory')
      setInventory([])
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustQuantity = (item: InventoryItem) => {
    if (item.type !== InventoryType.CONSUMABLE) return
    setSelectedItem(item)
    setQuantity(item.quantity?.toString() || '0')
    setAdjustDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedItem || quantity === '') return

    setSaving(true)
    try {
      const res = await fetch(
        `/api/properties/${selectedItem.Property.id}/inventory/${selectedItem.id}/adjust`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            quantity: parseFloat(quantity),
          }),
        }
      )

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to adjust quantity')
      }

      toast.success('Quantity updated')
      setAdjustDialogOpen(false)
      fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust quantity')
    } finally {
      setSaving(false)
    }
  }

  const isLowStock = (item: InventoryItem) => {
    if (item.type !== InventoryType.CONSUMABLE) return false
    if (!item.quantity || !item.minimumQuantity) return false
    return item.quantity <= item.minimumQuantity
  }

  const filteredInventory = inventory.filter((item) => {
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        item.name.toLowerCase().includes(searchLower) ||
        item.Property.name.toLowerCase().includes(searchLower) ||
        item.Property.nickname?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <TableSkeletonLoader />
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
            <Package className="w-5 h-5" />
            Inventory Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search items or properties..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="property">Property</Label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger id="property">
                  <SelectValue />
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
            <div className="w-full md:w-48">
              <Label htmlFor="type">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                  <SelectItem value="STATIONARY">Stationary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inventory Table */}
          {filteredInventory.length === 0 ? (
            <EmptyState
              title="No inventory items found"
              description={
                search || propertyFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No inventory items available. Add items in the property detail page.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Item</TableHead>
                  {typeFilter === 'CONSUMABLE' ? (
                    <>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Minimum</TableHead>
                      <TableHead>Status</TableHead>
                    </>
                  ) : (
                    <TableHead>Description</TableHead>
                  )}
                  <TableHead>Last Checked</TableHead>
                  {typeFilter === 'CONSUMABLE' && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item) => {
                  const lowStock = isLowStock(item)
                  return (
                    <TableRow key={item.id} className={lowStock ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">
                        {item.Property?.nickname || item.Property?.name || 'Unknown Property'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.name}
                          {lowStock && (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </TableCell>
                      {typeFilter === 'CONSUMABLE' ? (
                        <>
                          <TableCell>
                            <span className="font-medium">
                              {item.quantity || 0} {item.unit || 'pieces'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.minimumQuantity
                              ? `${item.minimumQuantity} ${item.unit || 'pieces'}`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {lowStock ? (
                              <Badge variant="destructive">Low Stock</Badge>
                            ) : (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                In Stock
                              </Badge>
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="text-sm text-gray-600">
                          {item.description || '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        {item.lastCheckedAt ? (
                          format(new Date(item.lastCheckedAt), 'MMM dd, yyyy')
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </TableCell>
                      {typeFilter === 'CONSUMABLE' && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAdjustQuantity(item)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Update
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Quantity Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Quantity</DialogTitle>
            <DialogDescription>
              Update the current quantity for {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  New Quantity ({selectedItem.unit || 'pieces'})
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500">
                  Current: {selectedItem.quantity || 0} {selectedItem.unit || 'pieces'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Quantity'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

