import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

export const authConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        otp: { label: 'OTP Code', type: 'text', required: false },
      },
      async authorize(credentials) {
        try {
          console.log('[Auth] Authorize called with email:', credentials?.email)
          
          if (!credentials?.email || !credentials?.password) {
            console.log('[Auth] Missing credentials')
            return null
          }

          // Check database connection
          try {
            await prisma.$connect()
          } catch (dbError: any) {
            console.error('[Auth] Database connection error:', dbError)
            console.error('[Auth] Make sure DATABASE_URL is set correctly')
            return null
          }

          console.log('[Auth] Looking up user...')
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              role: true,
              ownerId: true,
              otpEnabled: true,
              otpCode: true,
              otpExpiresAt: true,
            },
          })
          console.log('[Auth] User found:', user ? `${user.email} (${user.role})` : 'null')

          if (!user) {
            console.log('[Auth] User not found for email:', credentials.email)
            console.log('[Auth] Make sure the database has been seeded. Run: npm run db:seed')
            return null
          }

          // Check if user has a password
          if (!user.password) {
            console.log('[Auth] User has no password set')
            return null
          }

          console.log('[Auth] Comparing password...')
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )
          console.log('[Auth] Password valid:', isPasswordValid)

          if (!isPasswordValid) {
            console.log('[Auth] Invalid password for user:', user.email)
            console.log('[Auth] Default password from seed is: admin123')
            return null
          }

          // Check if OTP is enabled
          if (user.otpEnabled) {
            console.log('[Auth] OTP is enabled for user')
            
            // If OTP code is provided, verify it
            if (credentials.otp) {
              if (!user.otpCode || !user.otpExpiresAt) {
                console.log('[Auth] No OTP code found in database')
                // Return null to indicate failure, but we'll handle OTP requirement in login page
                return null
              }

              if (user.otpCode !== credentials.otp) {
                console.log('[Auth] Invalid OTP code')
                // Return null for invalid OTP - login page will handle the error
                return null
              }

              if (new Date() > user.otpExpiresAt) {
                console.log('[Auth] OTP code expired')
                // Return null for expired OTP - login page will handle the error
                return null
              }

              // Clear OTP after successful verification
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  otpCode: null,
                  otpExpiresAt: null,
                },
              })

              console.log('[Auth] OTP verified successfully')
            } else {
              // OTP is enabled but not provided - return null
              // The login page will detect this and request OTP
              console.log('[Auth] OTP is enabled but not provided')
              return null
            }
          }

          console.log('[Auth] Success, returning user:', user.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            ownerId: user.ownerId,
          }
        } catch (error: any) {
          console.error('[Auth] Error in authorize:', error)
          console.error('[Auth] Error details:', error?.message, error?.stack)
          
          // Re-throw OTP-related errors so they can be handled by the login page
          if (error.message === 'OTP_REQUIRED' || error.message === 'INVALID_OTP' || error.message === 'OTP_EXPIRED') {
            throw error
          }
          
          // Return null on other errors - NextAuth expects null for failed authentication
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.ownerId = user.ownerId
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.ownerId = token.ownerId as string | null
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
} satisfies NextAuthConfig

// For compatibility with existing code
export const authOptions = authConfig
