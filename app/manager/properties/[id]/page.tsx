'use client'

import { PropertyDetailPage } from '@/components/pages/property-detail-page'
import { use } from 'react'

export default function ManagerPropertyDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  return <PropertyDetailPage propertyId={id} />
}

