'use client'

import { useEffect, useRef } from 'react'

export function DynamicFavicon() {
  const faviconLinkRef = useRef<HTMLLinkElement | null>(null)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !document.head) return

    const updateFavicon = async () => {
      try {
        const res = await fetch('/api/settings/favicon/public')
        if (res.ok) {
          const data = await res.json()
          const faviconUrl = data.faviconUrl || '/favicon.ico'
          
          // Remove our previously created favicon link if it exists
          if (faviconLinkRef.current && faviconLinkRef.current.parentNode) {
            try {
              faviconLinkRef.current.parentNode.removeChild(faviconLinkRef.current)
            } catch (e) {
              // Ignore if already removed
            }
            faviconLinkRef.current = null
          }
          
          // Find and update existing favicon link, or create new one
          let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement
          
          if (faviconLink) {
            // Update existing favicon
            faviconLink.href = faviconUrl
            faviconLink.type = faviconUrl.endsWith('.svg') ? 'image/svg+xml' : faviconUrl.endsWith('.png') ? 'image/png' : 'image/x-icon'
            faviconLinkRef.current = faviconLink
          } else {
            // Create new favicon link
            faviconLink = document.createElement('link')
            faviconLink.rel = 'icon'
            faviconLink.href = faviconUrl
            faviconLink.type = faviconUrl.endsWith('.svg') ? 'image/svg+xml' : faviconUrl.endsWith('.png') ? 'image/png' : 'image/x-icon'
            
            if (document.head) {
              document.head.appendChild(faviconLink)
              faviconLinkRef.current = faviconLink
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch favicon:', error)
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      updateFavicon()
    })

    return () => {
      cancelAnimationFrame(rafId)
      // Cleanup: remove our favicon link if component unmounts
      if (faviconLinkRef.current && faviconLinkRef.current.parentNode) {
        try {
          faviconLinkRef.current.parentNode.removeChild(faviconLinkRef.current)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [])

  return null
}

