'use client'

import { GuestContactForm } from '@/components/forms/guest-contact-form'
import { useEffect, useState, use } from 'react'

interface GuestContactFormPageProps {
  params?: Promise<{ id: string }>
  redirectPath?: string
}

export function GuestContactFormPage({ params, redirectPath }: GuestContactFormPageProps) {
  const [contactId, setContactId] = useState<string | undefined>()
  const [initialData, setInitialData] = useState<any>(null)
  
  useEffect(() => {
    if (params) {
      params.then((p) => {
        if (p.id && p.id !== 'new') {
          setContactId(p.id)
          fetch(`/api/guest-contacts/${p.id}`)
            .then((res) => res.json())
            .then((data) => setInitialData(data))
            .catch((error) => console.error('Failed to fetch contact:', error))
        }
      })
    }
  }, [params])

  return <GuestContactForm contactId={contactId} initialData={initialData} redirectPath={redirectPath} />
}
