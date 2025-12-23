'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function TopLoadingBar() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [themeColor, setThemeColor] = useState('#f97316') // Default orange
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Fetch theme color
  useEffect(() => {
    const fetchThemeColor = async () => {
      try {
        const res = await fetch('/api/settings/theme/public')
        if (res.ok) {
          const data = await res.json()
          setThemeColor(data.themeColor || '#f97316')
        }
      } catch (error) {
        console.error('Failed to fetch theme color:', error)
      }
    }
    fetchThemeColor()
  }, [])

  useEffect(() => {
    // Reset and start loading on route change
    setLoading(true)
    setProgress(10) // Start at 10% immediately

    // Simulate progress with realistic timing
    let currentProgress = 10
    const interval = setInterval(() => {
      if (currentProgress >= 90) {
        clearInterval(interval)
        return
      }
      
      // Faster at start, slower as it progresses (like YouTube)
      let increment: number
      if (currentProgress < 30) {
        increment = 15
      } else if (currentProgress < 60) {
        increment = 8
      } else {
        increment = 3
      }
      
      currentProgress = Math.min(currentProgress + increment, 90)
      setProgress(currentProgress)
    }, 150)

    // Complete loading when page is ready
    const handleLoad = () => {
      clearInterval(interval)
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 300)
    }

    // Listen for page load
    if (document.readyState === 'complete') {
      setTimeout(handleLoad, 200)
    } else {
      window.addEventListener('load', handleLoad)
    }

    return () => {
      clearInterval(interval)
      window.removeEventListener('load', handleLoad)
    }
  }, [pathname, searchParams])

  if (!loading && progress === 0) {
    return null
  }

  // Convert hex color to RGB for box shadow
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 234, g: 88, b: 12 } // Default orange
  }

  const rgb = hexToRgb(themeColor)

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
      <div
        className="h-full transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          backgroundColor: themeColor,
          boxShadow: `0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6), 0 0 5px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
        }}
      />
    </div>
  )
}

