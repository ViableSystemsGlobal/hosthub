'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserProfileMenu } from '@/components/ui/user-profile-menu'
import { AppLogo } from '@/components/ui/app-logo'
import {
  LayoutDashboard,
  Building2,
  FileText,
  MessageSquare,
  Menu,
  X,
  AlertTriangle,
  Sparkles,
  CalendarCheck,
  Zap,
  Package,
  Calendar,
} from 'lucide-react'

const navItems = [
  { href: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/owner/properties', label: 'Properties', icon: Building2 },
  { href: '/owner/bookings', label: 'Bookings', icon: Calendar },
  { href: '/owner/statements', label: 'Statements', icon: FileText },
  { href: '/owner/reports', label: 'Reports', icon: FileText },
  { href: '/owner/cleaning-tasks', label: 'Cleaning Tasks', icon: Sparkles },
  { href: '/owner/check-ins', label: 'Check-Ins', icon: CalendarCheck },
  { href: '/owner/electricity-readings', label: 'Electricity', icon: Zap },
  { href: '/owner/inventory', label: 'Inventory', icon: Package },
  { href: '/owner/issues', label: 'Issues', icon: AlertTriangle },
  { href: '/owner/messages', label: 'Messages', icon: MessageSquare },
]

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Fixed Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 z-50 flex flex-col transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-center relative">
          <AppLogo height={32} width={120} />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute right-4"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            // Check if pathname starts with the item href (for detail pages)
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                style={isActive ? { color: 'var(--theme-color, #f97316)', backgroundColor: 'var(--theme-color-lighter, rgba(249, 115, 22, 0.05))' } : undefined}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

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
                {navItems.find((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))?.label || 'Owner Portal'}
              </h2>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <UserProfileMenu role={session?.user?.role} />
            </div>
          </div>
        </header>

        {/* Scrollable Page content */}
        <main className="pt-24 pb-20 md:pb-6 p-6 min-h-screen">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 md:hidden">
        <div className="grid grid-cols-5 h-16">
          <Link
            href="/owner/dashboard"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/owner/dashboard' || pathname?.startsWith('/owner/dashboard/') ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-xs">Dashboard</span>
          </Link>
          <Link
            href="/owner/properties"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/owner/properties' || pathname?.startsWith('/owner/properties/') ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-xs">Properties</span>
          </Link>
          <Link
            href="/owner/statements"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/owner/statements' || pathname?.startsWith('/owner/statements/') ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">Statements</span>
          </Link>
          <Link
            href="/owner/issues"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/owner/issues' || pathname?.startsWith('/owner/issues/') ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs">Issues</span>
          </Link>
          <Link
            href="/owner/messages"
            className="flex flex-col items-center justify-center gap-1"
            style={{ color: pathname === '/owner/messages' || pathname?.startsWith('/owner/messages/') ? 'var(--theme-color, #f97316)' : '#4B5563' }}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">Messages</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

