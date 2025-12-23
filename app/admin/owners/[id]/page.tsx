'use client'

import { OwnerDetailPage } from '@/components/pages/owner-detail-page'
import { use } from 'react'

export default function AdminOwnerDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  return <OwnerDetailPage ownerId={id} />
}

