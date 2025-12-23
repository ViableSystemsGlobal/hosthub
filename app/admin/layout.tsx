'use client'

import dynamic from 'next/dynamic'

// Dynamically import AdminLayout with SSR disabled to prevent hydration issues with usePathname
const AdminLayout = dynamic(
  () => import('@/components/layout/admin-layout').then((mod) => mod.AdminLayout),
  {
    ssr: false,
  }
)

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}

