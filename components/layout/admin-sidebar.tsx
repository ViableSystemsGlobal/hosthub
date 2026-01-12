'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/ui/app-logo'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  Calendar,
  Receipt,
  FileText,
  MessageSquare,
  ClipboardList,
  Sparkles,
  X,
  AlertTriangle,
  Phone,
  Settings,
  Bell,
  BarChart3,
  FolderOpen,
  Mail,
  MessageCircle,
  TrendingUp,
  GitBranch,
  Repeat,
  CheckCircle2,
  Zap,
  Package,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: any
}

interface NavGroup {
  label: string
  icon: any
  items: NavItem[]
  defaultOpen?: boolean
}

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    icon: LayoutDashboard,
    items: [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
    defaultOpen: true,
  },
  {
    label: 'Management',
    icon: Users,
    items: [
  { href: '/admin/users', label: 'Users', icon: UserCog },
  { href: '/admin/owners', label: 'Owners', icon: Users },
  { href: '/admin/properties', label: 'Properties', icon: Building2 },
    ],
    defaultOpen: true,
  },
  {
    label: 'Operations',
    icon: ClipboardList,
    items: [
  { href: '/admin/bookings', label: 'Bookings', icon: Calendar },
      { href: '/admin/checkin', label: 'Check-In', icon: CheckCircle2 },
      { href: '/admin/cleaning-tasks', label: 'Cleaning Tasks', icon: Sparkles },
      { href: '/admin/inventory-entry', label: 'Inventory Entry', icon: Package },
      { href: '/admin/electricity-readings', label: 'Electricity Readings', icon: Zap },
  { href: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { href: '/admin/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/admin/issues', label: 'Issues', icon: AlertTriangle },
      { href: '/admin/guest-contacts', label: 'Guest Contacts', icon: Users },
    ],
    defaultOpen: true,
  },
  {
    label: 'Financial',
    icon: Receipt,
    items: [
  { href: '/admin/statements', label: 'Statements', icon: FileText },
  { href: '/admin/documents', label: 'Documents', icon: FolderOpen },
    ],
  },
  {
    label: 'Communications',
    icon: MessageSquare,
    items: [
  { href: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/email-templates', label: 'Email Templates', icon: Mail },
  { href: '/admin/sms-templates', label: 'SMS Templates', icon: MessageCircle },
      { href: '/admin/contacts', label: 'Contacts', icon: Phone },
    ],
  },
  {
    label: 'Analytics & AI',
    icon: BarChart3,
    items: [
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/admin/marketing', label: 'Marketing AI', icon: Sparkles },
    ],
  },
  {
    label: 'Automation',
    icon: GitBranch,
    items: [
  { href: '/admin/workflows', label: 'Workflows', icon: GitBranch },
      { href: '/admin/recurring-tasks', label: 'Recurring Tasks', icon: Repeat },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [
  { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

interface AdminSidebarProps {
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

export function AdminSidebar({ mobileMenuOpen, setMobileMenuOpen }: AdminSidebarProps) {
  const pathname = usePathname()
  
  // Initialize open state - open groups that contain active items or have defaultOpen
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initiallyOpen = new Set<string>()
    navGroups.forEach((group) => {
      const hasActiveItem = group.items.some(
        (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`)
      )
      if (hasActiveItem || group.defaultOpen) {
        initiallyOpen.add(group.label)
      }
    })
    return initiallyOpen
  })

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupLabel)) {
        next.delete(groupLabel)
      } else {
        next.add(groupLabel)
      }
      return next
    })
  }

  return (
    <>
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
        <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
          {navGroups.map((group) => {
            const GroupIcon = group.icon
            const isOpen = openGroups.has(group.label)
            const hasActiveItem = group.items.some(
              (item) => pathname === item.href || pathname?.startsWith(`${item.href}/`)
            )

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                    hasActiveItem
                      ? ''
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  style={hasActiveItem ? { color: 'var(--theme-color, #f97316)', backgroundColor: 'var(--theme-color-lighter, rgba(249, 115, 22, 0.05))' } : undefined}
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <GroupIcon className="w-4 h-4" />
                  <span className="flex-1 text-left">{group.label}</span>
                </button>
                {isOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                style={isActive ? { color: 'var(--theme-color, #f97316)', backgroundColor: 'var(--theme-color-lighter, rgba(249, 115, 22, 0.05))' } : undefined}
              >
                          <Icon className="w-4 h-4" style={isActive ? { color: 'var(--theme-color, #f97316)' } : undefined} />
                <span>{item.label}</span>
              </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

