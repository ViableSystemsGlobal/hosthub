'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ThemeContextType {
  themeColor: string
  setThemeColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  themeColor: '#f97316',
  setThemeColor: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// Convert hex to HSL for CSS variable compatibility
function hexToHSL(hex: string): string {
  // Remove the hash
  hex = hex.replace('#', '')

  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  // Return as "H S% L%" format for CSS
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

// Calculate a darker shade for hover states
function getDarkerShade(hex: string): string {
  hex = hex.replace('#', '')
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 20)
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 20)
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 20)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Calculate a lighter shade for backgrounds
function getLighterShade(hex: string, opacity: number = 0.1): string {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeColor, setThemeColor] = useState('#f97316')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Fetch theme color from public API
    fetch('/api/settings/theme/public')
      .then((res) => res.json())
      .then((data) => {
        if (data.themeColor && /^#[0-9A-Fa-f]{6}$/.test(data.themeColor)) {
          setThemeColor(data.themeColor)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch theme color:', err)
      })
      .finally(() => {
        setMounted(true)
      })
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Apply theme color to CSS custom properties
    const root = document.documentElement
    const hsl = hexToHSL(themeColor)
    
    // Set primary color variants
    root.style.setProperty('--primary', hsl)
    root.style.setProperty('--primary-foreground', '0 0% 100%')
    root.style.setProperty('--theme-color', themeColor)
    root.style.setProperty('--theme-color-dark', getDarkerShade(themeColor))
    root.style.setProperty('--theme-color-light', getLighterShade(themeColor, 0.1))
    root.style.setProperty('--theme-color-lighter', getLighterShade(themeColor, 0.05))
    
    // Also update ring color for focus states
    root.style.setProperty('--ring', hsl)
  }, [themeColor, mounted])

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

