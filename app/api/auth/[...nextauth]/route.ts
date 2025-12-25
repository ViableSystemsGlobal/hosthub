import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth'

if (!process.env.AUTH_SECRET) {
  console.warn('[NextAuth] AUTH_SECRET is not set. This is required for production. Generate one with: openssl rand -base64 32')
}

const isProduction = process.env.NODE_ENV === 'production'

const { handlers } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  trustHost: true,
  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
    callbackUrl: {
      name: isProduction ? '__Secure-authjs.callback-url' : 'authjs.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
    csrfToken: {
      name: isProduction ? '__Host-authjs.csrf-token' : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
  },
})

export const { GET, POST } = handlers
