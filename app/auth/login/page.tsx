'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRole } from '@prisma/client'
import { toast } from '@/lib/toast'
import { Shield } from 'lucide-react'
import { AppLogo } from '@/components/ui/app-logo'

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpMethod, setOtpMethod] = useState<'EMAIL' | 'SMS'>('EMAIL')
  const [sendingOtp, setSendingOtp] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const role = session.user.role
      const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE, UserRole.OPERATIONS]
      
      if (adminRoles.includes(role)) {
        window.location.href = '/admin/dashboard'
      } else if (role === UserRole.MANAGER) {
        window.location.href = '/manager/dashboard'
      } else if (role === UserRole.OWNER) {
        window.location.href = '/owner/dashboard'
      }
    }
  }, [status, session])

  const requestOtp = async (method?: 'EMAIL' | 'SMS') => {
    setSendingOtp(true)
    setError('')
    
    // Use provided method or fall back to state
    const methodToUse = method || otpMethod
    
    try {
      console.log('[Login] Requesting OTP for:', email, 'Method:', methodToUse)
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, method: methodToUse }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        console.error('[Login] OTP request failed:', data)
        throw new Error(data.error || 'Failed to send OTP')
      }
      
      console.log('[Login] OTP sent successfully:', data.message)
      toast.success('OTP sent', data.message || `OTP sent to your ${methodToUse === 'SMS' ? 'phone' : 'email'}`)
      // Update otpMethod state if it was passed as parameter
      if (method) {
        setOtpMethod(method)
      }
      setOtpRequired(true) // Show OTP input field
    } catch (err: any) {
      console.error('[Login] OTP request error:', err)
      const errorMessage = err?.message || 'Failed to send OTP'
      setError(errorMessage)
      toast.error('OTP Error', errorMessage)
      // Don't set otpRequired to true if OTP sending failed
      setOtpRequired(false)
      throw err // Re-throw so caller knows it failed
    } finally {
      setSendingOtp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('[Login] Attempting to sign in with email:', email)
      
      // If OTP is required but not provided, request it first
      if (otpRequired && !otp) {
        await requestOtp()
        setLoading(false)
        return
      }

      // If OTP is not yet required, validate credentials first
      if (!otpRequired) {
        const validateRes = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        
        const validateData = await validateRes.json()
        
        if (!validateData.valid) {
          setError(validateData.error || 'Invalid email or password')
          toast.error('Login failed', validateData.error || 'Invalid email or password')
          setLoading(false)
          return
        }
        
        // If OTP is enabled, request it immediately
        if (validateData.otpEnabled) {
          const method = (validateData.otpMethod || 'EMAIL') as 'EMAIL' | 'SMS'
          setOtpMethod(method)
          // Request OTP with the method directly - don't rely on state update
          try {
            await requestOtp(method)
          } catch (err) {
            // Error already handled in requestOtp
            console.error('Failed to request OTP:', err)
          }
          setLoading(false)
          return
        }
      }

      // Proceed with login (with OTP if required)
      const result = await signIn('credentials', {
        email,
        password,
        otp: otpRequired ? otp : undefined,
        redirect: false,
      })

      console.log('[Login] Sign in result:', result)

      if (result?.error) {
        console.error('[Login] Sign in error:', result.error)
        
        // If OTP was provided but still failed, it might be invalid
        if (otpRequired && result.error === 'CredentialsSignin') {
          setError('Invalid OTP code. Please try again.')
          toast.error('Invalid OTP', 'The code you entered is incorrect')
          setOtp('')
          setLoading(false)
          return
        }
        
        setError(result.error === 'CredentialsSignin' ? 'Invalid email or password' : result.error)
        toast.error('Login failed', result.error === 'CredentialsSignin' ? 'Invalid email or password' : result.error)
        setLoading(false)
        return
      }

      if (result?.ok) {
        console.log('[Login] Sign in successful, fetching session...')
        toast.success('Login successful', 'Welcome back!')
        
        // Wait a moment for session to be established, then redirect
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Force a full page reload to the dashboard
        // This ensures cookies are properly sent with the new request
        window.location.replace('/admin/dashboard')
        return
      }
    } catch (err: any) {
      console.error('Login error:', err)
      
      // Handle OTP-related errors from authorize function
      if (err?.message === 'OTP_REQUIRED') {
        await requestOtp()
        setLoading(false)
        return
      }
      
      setError(err?.message || 'An error occurred. Please try again.')
      toast.error('Login error', err?.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex flex-col items-center mb-4">
            <AppLogo height={48} width={180} />
            <CardTitle className="mt-4">Login</CardTitle>
          </div>
          <CardDescription>
            {otpRequired 
              ? 'Enter your verification code to complete login' 
              : 'Enter your credentials to access your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!otpRequired ? (
              <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                    disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                    disabled={loading}
              />
            </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Two-Factor Authentication</p>
                      <p className="text-xs text-blue-700">
                        A verification code has been sent to your {otpMethod === 'SMS' ? 'phone' : 'email'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={loading}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 text-center">
                      Enter the 6-digit code sent to your {otpMethod === 'SMS' ? 'phone' : 'email'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      setOtpRequired(false)
                      setOtp('')
                      await requestOtp()
                    }}
                    disabled={sendingOtp || loading}
                  >
                    {sendingOtp ? 'Sending...' : 'Resend Code'}
                  </Button>
                </div>
              </>
            )}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || sendingOtp}>
              {loading 
                ? (otpRequired ? 'Verifying...' : 'Signing in...') 
                : (otpRequired ? 'Verify & Sign In' : 'Sign In')}
            </Button>
            {otpRequired && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpRequired(false)
                  setOtp('')
                  setError('')
                }}
                disabled={loading}
              >
                Back to Login
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

