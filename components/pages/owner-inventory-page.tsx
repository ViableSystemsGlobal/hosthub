'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Package, Filter, AlertTriangle } from 'lucide-react'
import { InventoryType, InventoryStatus } from '@prisma/client'

interface InventoryItem {
  id: string
  name: string
  type: InventoryType
  quantity: number | null
  minimumQuantity: number | null
  unit: string | null
  status: InventoryStatus
  Property: {
    id: string
    name: string
    nickname: string | null
  }
  LastCheckedBy: {
    id: string
    name: string
    email: string
  } | null
}

export function OwnerInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [properties, setProperties] = useState<Array<{ id: string; name: string; nickname: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    if (properties.length > 0) {
      fetchInventory()
    }
  }, [propertyFilter, typeFilter, properties])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setProperties(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const propertyIds = propertyFilter === 'all' 
        ? properties.map(p => p.id)
        : [propertyFilter]

      const allInventory: InventoryItem[] = []
      for (const propertyId of propertyIds) {
        const params = new URLSearchParams()
        if (typeFilter !== 'all') {
          params.append('type', typeFilter)
        }
        const res = await fetch(`/api/properties/${propertyId}/inventory?${params.toString()}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          allInventory.push(...(Array.isArray(data) ? data : []))
        }
      }

      setInventory(allInventory)
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (item: InventoryItem) => {
    if (item.type === InventoryType.CONSUMABLE && item.minimumQuantity !== null && item.quantity !== null) {
      if (item.quantity < item.minimumQuantity) {
        return <Badge className="bg-red-100 text-red-800">Low Stock</Badge>
      }
    }
    switch (item.status) {
      case InventoryStatus.AVAILABLE:
        return <Badge className="bg-green-100 text-green-800">Available</Badge>
      case InventoryStatus.MISSING:
        return <Badge className="bg-red-100 text-red-800">Missing</Badge>
      case InventoryStatus.DAMAGED:
        return <Badge className="bg-yellow-100 text-yellow-800">Damaged</Badge>
      default:
        return <Badge>{item.status}</Badge>
    }
  }

  const lowStockItems = inventory.filter(item => 
    item.type === InventoryType.CONSUMABLE && 
    item.minimumQuantity !== null && 
    item.quantity !== null &&
    item.quantity < item.minimumQuantity
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            Inventory
          </h1>
          <p className="text-gray-600 mt-1">View inventory status for your properties</p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Items ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="p-3 bg-white rounded border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {item.Property.nickname || item.Property.name} - {item.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Current: {item.quantity} {item.unit || ''} | Minimum: {item.minimumQuantity} {item.unit || ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Property</label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value={InventoryType.STATIONARY}>Stationary</SelectItem>
                  <SelectItem value={InventoryType.CONSUMABLE}>Consumable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          {inventory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No inventory items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Checked By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.Property.nickname || item.Property.name}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.type === InventoryType.STATIONARY ? 'Stationary' : 'Consumable'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.quantity !== null 
                        ? `${item.quantity} ${item.unit || ''}`
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                    <TableCell>
                      {item.LastCheckedBy?.name || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

