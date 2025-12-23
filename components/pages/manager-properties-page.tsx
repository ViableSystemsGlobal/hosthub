'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { Eye, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/ui/metric-card'
import { formatCurrency } from '@/lib/currency'
import { Currency } from '@prisma/client'

interface Property {
  id: string
  name: string
  nickname?: string
  city?: string
  currency: Currency
  status: string
  Owner: {
    id: string
    name: string
  }
}

export function ManagerPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/manager/properties')
      if (!res.ok) {
        throw new Error('Failed to fetch properties')
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setProperties(data)
      } else if (data.error) {
        console.error('API error:', data.error)
        setProperties([])
      } else {
        setProperties([])
      }
    } catch (error: any) {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  // Calculate metrics
  const totalProperties = properties.length
  const activeProperties = properties.filter(p => p.status === 'active').length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Assigned Properties</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Properties"
          value={totalProperties}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Active Properties"
          value={activeProperties}
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {!Array.isArray(properties) || properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="No properties assigned"
          description="You don't have any properties assigned to you yet."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">
                      {property.nickname || property.name}
                    </TableCell>
                    <TableCell>{property.Owner.name}</TableCell>
                    <TableCell>{property.city || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={property.status === 'active' ? 'default' : 'secondary'}
                      >
                        {property.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/manager/properties/${property.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
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

