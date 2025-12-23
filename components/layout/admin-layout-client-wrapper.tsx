'use client'

import { AdminLayout } from './admin-layout'

export function AdminLayoutClientWrapper({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}

