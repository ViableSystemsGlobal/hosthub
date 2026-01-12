import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { UserRole } from '@prisma/client'

export async function middleware(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const token = await getToken({ 
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    cookieName: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token',
  })

  const path = request.nextUrl.pathname

  // Public routes that don't require auth
  if (path === '/auth/login' || path.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Check if user is authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

    // Admin routes - only accessible by admin roles
    if (path.startsWith('/admin')) {
      const adminRoles: string[] = [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.FINANCE,
        UserRole.OPERATIONS,
      ]
      if (!adminRoles.includes(token.role as string)) {
        // Redirect managers/general managers to manager dashboard, owners to owner dashboard
        if ((token.role as string) === UserRole.MANAGER || (token.role as string) === UserRole.GENERAL_MANAGER) {
          return NextResponse.redirect(new URL('/manager/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/owner/dashboard', request.url))
      }
    }

    // Manager routes - accessible by managers and general managers
    if (path.startsWith('/manager')) {
      if ((token.role as string) !== UserRole.MANAGER && (token.role as string) !== UserRole.GENERAL_MANAGER) {
        // Redirect to appropriate dashboard based on role
        const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE, UserRole.OPERATIONS]
        if (adminRoles.includes(token.role as UserRole)) {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/owner/dashboard', request.url))
      }
    }

    // Owner routes - only accessible by owners
    if (path.startsWith('/owner')) {
      if ((token.role as string) !== UserRole.OWNER) {
        // Redirect managers/general managers to manager dashboard, admins to admin dashboard
        if ((token.role as string) === UserRole.MANAGER || (token.role as string) === UserRole.GENERAL_MANAGER) {
          return NextResponse.redirect(new URL('/manager/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
    }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/manager/:path*',
    '/owner/:path*',
    '/api/(owners|properties|bookings|expenses|statements|tasks|conversations|ai|notifications|manager)/:path*',
  ],
}
