import { getToken } from 'next-auth/jwt'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function getCurrentUser(request?: NextRequest) {
  let token
  
  if (request) {
    // For API routes, use the request object directly
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
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
      secret: process.env.AUTH_SECRET,
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
