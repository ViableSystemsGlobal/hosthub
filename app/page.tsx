import { redirect } from 'next/navigation'
import { getToken } from 'next-auth/jwt'
import { cookies } from 'next/headers'
import { UserRole } from '@prisma/client'

export default async function Home() {
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map(c => `${c.name}=${c.value}`)
    .join('; ')
  
  const token = await getToken({
    req: {
      headers: {
        cookie: cookieHeader,
      },
    } as any,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    cookieName: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token',
  })

  if (token) {
    // Redirect to appropriate dashboard based on role
    const role = token.role as UserRole
    const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE, UserRole.OPERATIONS]
    
    if (adminRoles.includes(role)) {
      redirect('/admin/dashboard')
    } else if (role === UserRole.MANAGER) {
      redirect('/manager/dashboard')
    } else if (role === UserRole.OWNER) {
      redirect('/owner/dashboard')
    }
  }

  redirect('/auth/login')
}
