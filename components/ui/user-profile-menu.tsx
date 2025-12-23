'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Settings } from 'lucide-react'
import Link from 'next/link'
import { UserRole } from '@prisma/client'

interface UserProfileMenuProps {
  role?: UserRole
}

export function UserProfileMenu({ role }: UserProfileMenuProps) {
  const { data: session } = useSession()
  const userRole = role || session?.user?.role
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    // Fetch profile image
    const fetchProfileImage = async () => {
      try {
        const res = await fetch('/api/profile', {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setProfileImage(data.image || null)
        }
      } catch (error) {
        // Ignore errors
      }
    }
    fetchProfileImage()
  }, [])

  const handleLogout = async () => {
    const currentOrigin = window.location.origin
    await signOut({
      callbackUrl: `${currentOrigin}/auth/login`,
      redirect: false, // We'll handle redirect manually
    })
    // Force redirect to ensure we use the current port
    window.location.href = `${currentOrigin}/auth/login`
  }

  // Get user initials from name or email
  const getInitials = () => {
    if (session?.user?.name) {
      return session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (session?.user?.email) {
      return session.user.email[0].toUpperCase()
    }
    return 'U'
  }

  // Get profile path based on role
  const getProfilePath = () => {
    switch (userRole) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return '/admin/profile'
      case 'MANAGER':
        return '/manager/profile'
      case 'OWNER':
        return '/owner/profile'
      default:
        return '/admin/profile'
    }
  }

  // Get settings path based on role
  const getSettingsPath = () => {
    switch (userRole) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return '/admin/settings'
      case 'MANAGER':
        return '/manager/settings'
      case 'OWNER':
        return '/owner/settings'
      default:
        return '/admin/settings'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
          <Avatar className="h-9 w-9 border-2 border-gray-200 hover:border-orange-300 transition-colors">
            <AvatarImage src={profileImage || undefined} alt={session?.user?.name || session?.user?.email || 'User'} />
            <AvatarFallback className="bg-orange-100 text-orange-600 font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {session?.user?.name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={getProfilePath()} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={getSettingsPath()} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

