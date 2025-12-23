'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'bg-white border border-gray-200 shadow-lg',
          title: 'text-gray-900 font-semibold',
          description: 'text-gray-600',
          success: 'border-green-200',
          error: 'border-red-200',
          warning: 'border-orange-200',
          info: 'border-blue-200',
        },
      }}
    />
  )
}

