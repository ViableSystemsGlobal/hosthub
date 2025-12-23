'use client'

import { useEffect, useState, use } from 'react'
import { OwnerForm } from '@/components/forms/owner-form'

export default function EditOwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [owner, setOwner] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/owners/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOwner(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div>Loading...</div>
  return <OwnerForm ownerId={id} initialData={owner} />
}

