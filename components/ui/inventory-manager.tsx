'use client'

import { useState, useEffect } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Loader2,
  History,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  X,
  ImageIcon,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { InventoryType, InventoryStatus } from '@prisma/client'
import { format } from 'date-fns'

interface InventoryItem {
  id: string
  name: string
  type: InventoryType
  description?: string | null
  quantity?: number | null
  minimumQuantity?: number | null
  unit?: string | null
  status: InventoryStatus
  photos?: string[]
  notes?: string | null
  lastCheckedAt?: string | null
  lastCheckedBy?: {
    name?: string | null
  } | null
  createdAt: string
  updatedAt: string
}

interface InventoryHistoryEntry {
  id: string
  previousQuantity: number | null
  newQuantity: number | null
  changeType: string
  notes?: string | null
  changedBy?: {
    name?: string | null
  } | null
  createdAt: string
}

interface InventoryManagerProps {
  propertyId: string
}

export function InventoryManager({ propertyId }: InventoryManagerProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [photoItem, setPhotoItem] = useState<InventoryItem | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    type: InventoryType
    description: string
    quantity: string
    minimumQuantity: string
    unit: string
    status: InventoryStatus
    notes: string
  }>({
    name: '',
    type: InventoryType.STATIONARY,
    description: '',
    quantity: '',
    minimumQuantity: '',
    unit: 'pieces',
    status: InventoryStatus.PRESENT,
    notes: '',
  })
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [propertyId])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/properties/${propertyId}/inventory`, {
        credentials: 'include',
      })

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(errorData.error || `Failed to fetch inventory: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      setInventory(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch inventory:', error)
      toast.error(error.message || 'Failed to load inventory')
      setInventory([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = () => {
    setSelectedItem(null)
    setFormData({
      name: '',
      type: InventoryType.STATIONARY,
      description: '',
      quantity: '',
      minimumQuantity: '',
      unit: 'pieces',
      status: InventoryStatus.PRESENT,
      notes: '',
    })
    setDialogOpen(true)
  }

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item)
    setFormData({
      name: item.name,
      type: item.type,
      description: item.description || '',
      quantity: item.quantity?.toString() || '',
      minimumQuantity: item.minimumQuantity?.toString() || '',
      unit: item.unit || 'pieces',
      status: item.status,
      notes: item.notes || '',
    })
    setDialogOpen(true)
  }

  const handleAdjustQuantity = (item: InventoryItem) => {
    setSelectedItem(item)
    setAdjustQuantity(item.quantity?.toString() || '0')
    setAdjustDialogOpen(true)
  }

  const handleViewHistory = async (item: InventoryItem) => {
    setHistoryItem(item)
    setHistoryDialogOpen(true)
    setLoadingHistory(true)
    
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/inventory/${item.id}/history`,
        {
          credentials: 'include',
        }
      )

      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
        return
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(errorData.error || 'Failed to fetch history')
      }

      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to fetch history:', error)
      toast.error(error.message || 'Failed to load history')
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      const url = selectedItem
        ? `/api/properties/${propertyId}/inventory/${selectedItem.id}`
        : `/api/properties/${propertyId}/inventory`
      const method = selectedItem ? 'PATCH' : 'POST'

      const body: any = {
        name: formData.name,
        type: formData.type,
        description: formData.description || null,
        notes: formData.notes || null,
      }

      if (formData.type === InventoryType.CONSUMABLE) {
        body.quantity = parseFloat(formData.quantity) || 0
        body.minimumQuantity = formData.minimumQuantity
          ? parseFloat(formData.minimumQuantity)
          : null
        body.unit = formData.unit || 'pieces'
      } else {
        body.status = formData.status
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save inventory item')
      }

      toast.success(selectedItem ? 'Inventory item updated' : 'Inventory item added')
      setDialogOpen(false)
      fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save inventory item')
    } finally {
      setSaving(false)
    }
  }

  const handleAdjust = async () => {
    if (!selectedItem || adjustQuantity === '') return

    setSaving(true)
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/inventory/${selectedItem.id}/adjust`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            quantity: parseFloat(adjustQuantity),
          }),
        }
      )

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

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.name}"? This action cannot be undone.`)) return

    try {
      const res = await fetch(
        `/api/properties/${propertyId}/inventory/${item.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete inventory item')
      }

      toast.success('Inventory item deleted')
      fetchInventory()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete inventory item')
    }
  }

  const stationaryItems = inventory.filter((item) => item.type === InventoryType.STATIONARY)
  const consumableItems = inventory.filter((item) => item.type === InventoryType.CONSUMABLE)

  const getStatusBadge = (status: InventoryStatus) => {
    switch (status) {
      case InventoryStatus.PRESENT:
        return <Badge variant="default" className="bg-green-100 text-green-800">Present</Badge>
      case InventoryStatus.MISSING:
        return <Badge variant="destructive">Missing</Badge>
      case InventoryStatus.DAMAGED:
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Damaged</Badge>
      case InventoryStatus.NEEDS_REPAIR:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Needs Repair</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const isLowStock = (item: InventoryItem) => {
    if (item.type !== InventoryType.CONSUMABLE) return false
    if (!item.quantity || !item.minimumQuantity) return false
    return item.quantity <= item.minimumQuantity
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">Loading inventory...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Management</CardTitle>
            <Button onClick={handleAddItem}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Items</TabsTrigger>
              <TabsTrigger value="stationary">Stationary</TabsTrigger>
              <TabsTrigger value="consumable">Consumable</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {/* Stationary Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Stationary Items ({stationaryItems.length})
                </h3>
                {stationaryItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No stationary items</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Checked</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stationaryItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.name}
                              {item.photos && item.photos.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {item.description || '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell>
                            {item.lastCheckedAt ? (
                              <div className="text-sm">
                                {format(new Date(item.lastCheckedAt), 'MMM dd, yyyy')}
                                {item.lastCheckedBy && (
                                  <div className="text-xs text-gray-500">
                                    by {item.lastCheckedBy.name || 'Unknown'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Never</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item)}
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
              </div>

              {/* Consumable Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Consumable Items ({consumableItems.length})
                </h3>
                {consumableItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No consumable items</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Minimum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Checked</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consumableItems.map((item) => {
                        const lowStock = isLowStock(item)
                        return (
                          <TableRow key={item.id} className={lowStock ? 'bg-red-50' : ''}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {item.name}
                                {lowStock && (
                                  <AlertTriangle className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                            </TableCell>
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
                            <TableCell>
                              {item.lastCheckedAt ? (
                                <div className="text-sm">
                                  {format(new Date(item.lastCheckedAt), 'MMM dd, yyyy')}
                                  {item.lastCheckedBy && (
                                    <div className="text-xs text-gray-500">
                                      by {item.lastCheckedBy.name || 'Unknown'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">Never</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewHistory(item)}
                                  title="View History"
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAdjustQuantity(item)}
                                >
                                  Adjust
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="stationary">
              {stationaryItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No stationary items</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Checked</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stationaryItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.description || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {item.lastCheckedAt ? (
                            <div className="text-sm">
                              {format(new Date(item.lastCheckedAt), 'MMM dd, yyyy')}
                            </div>
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(item)}
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
            </TabsContent>

            <TabsContent value="consumable">
              {consumableItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No consumable items</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Minimum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Checked</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumableItems.map((item) => {
                      const lowStock = isLowStock(item)
                      return (
                        <TableRow key={item.id} className={lowStock ? 'bg-red-50' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.name}
                              {lowStock && <AlertTriangle className="w-4 h-4 text-red-600" />}
                            </div>
                          </TableCell>
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
                          <TableCell>
                            {item.lastCheckedAt ? (
                              <div className="text-sm">
                                {format(new Date(item.lastCheckedAt), 'MMM dd, yyyy')}
                              </div>
                            ) : (
                              <span className="text-gray-400">Never</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAdjustQuantity(item)}
                              >
                                Adjust
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem
                ? 'Update inventory item details'
                : 'Add a new item to the inventory'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Item Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as InventoryType })
                }
                disabled={!!selectedItem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={InventoryType.STATIONARY}>Stationary (TV, Beds, etc.)</SelectItem>
                  <SelectItem value={InventoryType.CONSUMABLE}>
                    Consumable (Toilet Paper, Water, etc.)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 55-inch TV, Toilet Paper"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about the item"
                rows={3}
              />
            </div>

            {formData.type === InventoryType.CONSUMABLE ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Current Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="pieces, bottles, rolls, etc."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumQuantity">Minimum Quantity (Alert Threshold)</Label>
                  <Input
                    id="minimumQuantity"
                    type="number"
                    step="0.01"
                    value={formData.minimumQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, minimumQuantity: e.target.value })
                    }
                    placeholder="Leave empty to disable alerts"
                  />
                  <p className="text-xs text-gray-500">
                    Alert will be triggered when quantity falls below this value
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as InventoryStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={InventoryStatus.PRESENT}>Present</SelectItem>
                    <SelectItem value={InventoryStatus.MISSING}>Missing</SelectItem>
                    <SelectItem value={InventoryStatus.DAMAGED}>Damaged</SelectItem>
                    <SelectItem value={InventoryStatus.NEEDS_REPAIR}>Needs Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                selectedItem ? 'Update' : 'Add Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Quantity Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quantity</DialogTitle>
            <DialogDescription>
              Update the current quantity for {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjustQuantity">
                  New Quantity ({selectedItem.unit || 'pieces'})
                </Label>
                <Input
                  id="adjustQuantity"
                  type="number"
                  step="0.01"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
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
            <Button onClick={handleAdjust} disabled={saving}>
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

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quantity History - {historyItem?.name}</DialogTitle>
            <DialogDescription>
              Track quantity changes over time
            </DialogDescription>
          </DialogHeader>
          {loadingHistory ? (
            <div className="py-8 text-center text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No history available</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {history.map((entry: InventoryHistoryEntry, index: number) => {
                  const prevQty = entry.previousQuantity ?? 0
                  const newQty = entry.newQuantity ?? 0
                  const isIncrease = newQty > prevQty
                  const isDecrease = newQty < prevQty
                  const unit = historyItem?.unit || 'pieces'
                  
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex-shrink-0">
                        {isIncrease ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : isDecrease ? (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        ) : (
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {prevQty} {unit}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className={`font-bold ${isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-gray-600'}`}>
                            {newQty} {unit}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {entry.changeType}
                          </Badge>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm')}
                          {entry.changedBy && ` by ${entry.changedBy.name || 'Unknown'}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Management Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Photos - {photoItem?.name}</DialogTitle>
            <DialogDescription>
              Add or remove photos for this stationary item
            </DialogDescription>
          </DialogHeader>
          {photoItem && (
            <div className="space-y-4">
              {/* Existing Photos */}
              {photoItem.photos && photoItem.photos.length > 0 && (
                <div>
                  <Label>Current Photos</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    {photoItem.photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`${photoItem.name} ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `/api/properties/${propertyId}/inventory/${photoItem.id}/photos?photoUrl=${encodeURIComponent(photo)}`,
                                {
                                  method: 'DELETE',
                                  credentials: 'include',
                                }
                              )
                              if (res.ok) {
                                toast.success('Photo removed')
                                fetchInventory()
                                setPhotoItem({
                                  ...photoItem,
                                  photos: photoItem.photos?.filter((p) => p !== photo) || [],
                                })
                              } else {
                                throw new Error('Failed to remove photo')
                              }
                            } catch (error: any) {
                              toast.error(error.message || 'Failed to remove photo')
                            }
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload New Photos */}
              <div>
                <Label htmlFor="photoUpload">Upload New Photos</Label>
                <Input
                  id="photoUpload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files
                    if (!files || files.length === 0) return

                    setUploadingPhotos(true)
                    try {
                      const formData = new FormData()
                      Array.from(files).forEach((file) => {
                        formData.append('files', file)
                      })

                      const res = await fetch(
                        `/api/properties/${propertyId}/inventory/${photoItem.id}/photos`,
                        {
                          method: 'POST',
                          credentials: 'include',
                          body: formData,
                        }
                      )

                      if (!res.ok) {
                        const error = await res.json()
                        throw new Error(error.error || 'Failed to upload photos')
                      }

                      const updated = await res.json()
                      toast.success('Photos uploaded successfully')
                      fetchInventory()
                      setPhotoItem(updated)
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to upload photos')
                    } finally {
                      setUploadingPhotos(false)
                      // Reset input
                      e.target.value = ''
                    }
                  }}
                  disabled={uploadingPhotos}
                />
                {uploadingPhotos && (
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading photos...
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

