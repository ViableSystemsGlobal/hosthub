import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth'

if (!process.env.AUTH_SECRET) {
  console.warn('[NextAuth] AUTH_SECRET is not set. This is required for production. Generate one with: openssl rand -base64 32')
}

const { handlers } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret-change-in-production',
  trustHost: true, // Trust the host header (required for production behind proxy)
})

export const { GET, POST } = handlers
