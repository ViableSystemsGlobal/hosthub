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

interface Property {
  id: string
  name: string
  nickname?: string
  city?: string
  status: string
}

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      
      // Check if response is ok before parsing JSON
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Redirect to login if unauthorized
          window.location.href = '/auth/login'
          return
        }
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch properties' }))
        console.error('API error:', errorData.error || `HTTP ${res.status}`)
        setProperties([])
        return
      }
      
      const data = await res.json()
      
      // Handle error responses
      if (Array.isArray(data)) {
        setProperties(data)
      } else if (data.error) {
        console.error('API error:', data.error)
        setProperties([])
      } else {
        setProperties([])
      }
    } catch (error: any) {
      // Handle redirect errors or network errors
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
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Properties</h1>

      {properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="No properties yet"
          description="Your properties will appear here once they are added to the system."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
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
                  <TableCell>{property.city || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={property.status === 'active' ? 'default' : 'secondary'}
                    >
                      {property.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/owner/properties/${property.id}`}>
                      <button className="text-blue-600 hover:underline">
                        <Eye className="w-4 h-4 inline mr-1" />
                        View
                      </button>
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

