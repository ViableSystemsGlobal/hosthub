'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpenseCategory, Currency } from '@prisma/client'
import { toast } from '@/lib/toast'

interface ExpenseFormProps {
  expenseId?: string
  initialData?: any
}

export function ExpenseForm({ expenseId, initialData }: ExpenseFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isManager = pathname?.startsWith('/manager')
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [formData, setFormData] = useState({
    propertyId: initialData?.propertyId || '',
    category: initialData?.category || ExpenseCategory.OTHER,
    description: initialData?.description || '',
    amount: initialData?.amount || 0,
    currency: initialData?.currency || Currency.GHS,
    date: initialData?.date
      ? new Date(initialData.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    paidBy: initialData?.paidBy || 'company',
    linkedTaskId: initialData?.linkedTaskId || '',
  })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const endpoint = isManager ? '/api/manager/properties' : '/api/properties'
      const res = await fetch(endpoint)
      const data = await res.json()
      setProperties(data)
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (expenseId) {
        // Update existing expense
        const res = await fetch(`/api/expenses/${expenseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to update expense')
        }
      } else {
        // Create new expense with file upload
        const formDataToSend = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
          if (value) formDataToSend.append(key, value.toString())
        })
        if (file) {
          formDataToSend.append('file', file)
        }

        const res = await fetch('/api/expenses', {
          method: 'POST',
          body: formDataToSend,
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to create expense')
        }
      }

      toast.success(
        expenseId ? 'Expense updated' : 'Expense created',
        expenseId ? 'Expense has been updated successfully' : 'New expense has been added successfully'
      )
      const redirectPath = isManager ? '/manager/expenses' : '/admin/expenses'
      router.push(redirectPath)
      router.refresh()
    } catch (error: any) {
      toast.error('Error', error.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{expenseId ? 'Edit Expense' : 'New Expense'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property *</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) =>
                  setFormData({ ...formData, propertyId: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} - {property.Owner?.name || 'No owner'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      category: value as ExpenseCategory,
                    })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ExpenseCategory).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      currency: value as Currency,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.GHS}>GHS</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidBy">Paid By</Label>
              <Select
                value={formData.paidBy}
                onValueChange={(value) =>
                  setFormData({ ...formData, paidBy: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!expenseId && (
              <div className="space-y-2">
                <Label htmlFor="file">Receipt (optional)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Expense'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

