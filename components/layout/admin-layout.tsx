'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContactsSidebar } from '@/components/layout/contacts-sidebar'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { GlobalSearch } from '@/components/ui/global-search'
import { UserProfileMenu } from '@/components/ui/user-profile-menu'
import {
  LayoutDashboard,
  Building2,
  Calendar,
  MessageSquare,
  Menu,
} from 'lucide-react'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

      {/* Main content area */}
      <div className="md:ml-64">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 md:left-64 right-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-900">
                {(() => {
                  const items = [
                    { href: '/admin/dashboard', label: 'Dashboard' },
                    { href: '/admin/users', label: 'Users' },
                    { href: '/admin/owners', label: 'Owners' },
                    { href: '/admin/properties', label: 'Properties' },
                    { href: '/admin/bookings', label: 'Bookings' },
                    { href: '/admin/expenses', label: 'Expenses' },
                    { href: '/admin/tasks', label: 'Tasks' },
                    { href: '/admin/issues', label: 'Issues' },
                    { href: '/admin/contacts', label: 'Contacts' },
                    { href: '/admin/statements', label: 'Statements' },
                    { href: '/admin/messages', label: 'Messages' },
                    { href: '/admin/notifications', label: 'Notifications' },
                    { href: '/admin/email-templates', label: 'Email Templates' },
                    { href: '/admin/sms-templates', label: 'SMS Templates' },
                    { href: '/admin/marketing', label: 'Marketing AI' },
                    { href: '/admin/settings', label: 'Settings' },
                  ]
                  const item = items.find((item) => pathname === item.href || (pathname && pathname.startsWith(`${item.href}/`)))
                  return item?.label || 'Admin'
                })()}
              </h2>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <GlobalSearch />
              <UserProfileMenu role={session?.user?.role} />
            </div>
          </div>
        </header>

        {/* Scrollable Page content */}
        <main className="pt-24 pb-20 md:pb-6 p-6 min-h-screen">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 md:hidden">
        <div className="grid grid-cols-4 h-16">
          <Link
            href="/admin/dashboard"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/admin/dashboard' || (pathname && pathname.startsWith('/admin/dashboard/')) ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs">Dashboard</span>
          </Link>
          <Link
            href="/admin/properties"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/admin/properties' || (pathname && pathname.startsWith('/admin/properties/')) ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-xs">Properties</span>
          </Link>
          <Link
            href="/admin/bookings"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/admin/bookings' || (pathname && pathname.startsWith('/admin/bookings/')) ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs">Bookings</span>
          </Link>
          <Link
            href="/admin/messages"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/admin/messages' || (pathname && pathname.startsWith('/admin/messages/')) ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">Messages</span>
          </Link>
        </div>
      </nav>

      {/* Contacts Sidebar */}
      <ContactsSidebar />
    </div>
  )
}

