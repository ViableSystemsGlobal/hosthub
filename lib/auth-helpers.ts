import { getToken } from 'next-auth/jwt'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

// Auth configuration - must match NextAuth config
const isProduction = process.env.NODE_ENV === 'production'
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
const cookieName = isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token'

export async function getCurrentUser(request?: NextRequest) {
  let token
  
  if (request) {
    // For API routes, use the request object directly
    token = await getToken({
      req: request,
      secret: authSecret,
      cookieName,
    })
  } else {
    // For server components, use cookies
    const cookieStore = await cookies()
    const cookieHeader = cookieStore
      .getAll()
      .map(c => `${c.name}=${c.value}`)
      .join('; ')
    
    token = await getToken({
      req: {
        headers: {
          cookie: cookieHeader,
        },
      } as any,
      secret: authSecret,
      cookieName,
    })
  }

  if (!token) {
    return null
  }

  return {
    id: token.id as string,
    email: token.email as string,
    name: token.name as string | null,
    role: token.role as UserRole,
    ownerId: token.ownerId as string | null,
  }
}

export async function requireAuth(request?: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    if (request) {
      // For API routes, throw a specific error that can be caught and converted to HTTP response
      const error: any = new Error('Unauthorized')
      error.status = 401
      throw error
    }
    redirect('/auth/login')
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[], request?: NextRequest) {
  const user = await requireAuth(request)
  if (!allowedRoles.includes(user.role)) {
    if (request) {
      // For API routes, throw a specific error that can be caught and converted to HTTP response
      const error: any = new Error('Forbidden')
      error.status = 403
      throw error
    }
    redirect('/auth/login')
  }
  return user
}

export async function requireAdmin(request?: NextRequest) {
  return requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.FINANCE,
    UserRole.OPERATIONS,
  ], request)
}

export async function requireOwner(request?: NextRequest) {
  return requireRole([UserRole.OWNER], request)
}

// Helper to check if user is a manager (regular or general)
export function isManager(user: { role: UserRole }): boolean {
  return user.role === UserRole.MANAGER || user.role === UserRole.GENERAL_MANAGER
}

// Helper to check if user can edit/delete (admins and general managers)
export function canEditDelete(user: { role: UserRole }): boolean {
  return [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.FINANCE,
    UserRole.OPERATIONS,
    UserRole.GENERAL_MANAGER,
  ].includes(user.role)
}
