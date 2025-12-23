'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface AppLogoProps {
  className?: string
  height?: number
  width?: number
  fallbackText?: string
}

export function AppLogo({ className = '', height = 40, width = 120, fallbackText = 'HostHub' }: AppLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        // Use public endpoint (works for all users including login page)
        const res = await fetch('/api/settings/logo/public')
        if (res.ok) {
          const data = await res.json()
          if (data.logoUrl) {
            setLogoUrl(data.logoUrl)
          }
        }
      } catch (error) {
        console.error('Failed to fetch logo:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogo()
  }, [])

  if (loading) {
    return <div className={`text-xl font-bold text-gray-900 ${className}`}>{fallbackText}</div>
  }

  if (logoUrl) {
    return (
      <div className={`flex items-center ${className}`}>
        <Image
          src={logoUrl}
          alt="Logo"
          height={height}
          width={width}
          className="object-contain"
          unoptimized
        />
      </div>
    )
  }

  return <div className={`text-xl font-bold text-gray-900 ${className}`}>{fallbackText}</div>
}

