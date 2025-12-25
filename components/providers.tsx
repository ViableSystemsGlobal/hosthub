'use client'

import { Suspense } from 'react'
import { SessionProvider } from 'next-auth/react'
import { TopLoadingBar } from '@/components/ui/top-loading-bar'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/providers/theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <Suspense fallback={null}>
          <TopLoadingBar />
        </Suspense>
        <Toaster />
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}

