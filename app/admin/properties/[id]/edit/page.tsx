'use client'

import { useEffect, useState, use } from 'react'
import { PropertyForm } from '@/components/forms/property-form'

export default function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProperty(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div>Loading...</div>
  return <PropertyForm propertyId={id} initialData={property} />
}

