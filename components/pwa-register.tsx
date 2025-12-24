'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    // Avoid registering the service worker in development to prevent stale chunk issues.
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      (window as any).workbox !== undefined
    ) {
      // Workbox is available (if using next-pwa)
      return
    }

    // Manual service worker registration
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration)
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError)
          })
      })
    }
  }, [])

  return null
}
