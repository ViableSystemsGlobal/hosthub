'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/lib/toast'
import { Save, Loader2, User, Mail, Phone, Lock, Upload, X, Shield, CheckCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProfileData {
  name: string | null
  email: string
  phoneNumber: string | null
  image: string | null
  otpEnabled: boolean
  otpMethod: string | null
}

export function ManagerProfilePage() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({
    name: null,
    email: '',
    phoneNumber: null,
    image: null,
    otpEnabled: false,
    otpMethod: null,
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [requestingOtp, setRequestingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/profile', {
        credentials: 'include',
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/auth/login'
          return
        }
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch profile' }))
        throw new Error(errorData.error || `Failed to fetch profile: ${res.statusText}`)
      }

      const data = await res.json()
      setProfile({
        name: data.name || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
        image: data.image || null,
        otpEnabled: data.otpEnabled || false,
        otpMethod: data.otpMethod || null,
      })
    } catch (error: any) {
      toast.error(error.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: profile.name || null,
          email: profile.email,
          phoneNumber: profile.phoneNumber || null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update profile' }))
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const updatedData = await res.json()
      await update() // Update session
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: passwordData.newPassword,
          currentPassword: passwordData.currentPassword,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to change password' }))
        throw new Error(errorData.error || 'Failed to change password')
      }

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      toast.success('Password changed successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, and WebP are allowed.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size exceeds 5MB limit')
      return
    }

    try {
      setUploadingImage(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to upload image' }))
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const data = await res.json()
      setProfile({ ...profile, image: data.url })
      await update() // Update session
      toast.success('Profile image updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const handleRemoveImage = async () => {
    try {
      setUploadingImage(true)
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to remove image')
      }

      setProfile({ ...profile, image: null })
      await update() // Update session
      toast.success('Profile image removed successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRequestOtp = async (method: 'EMAIL' | 'SMS') => {
    try {
      setRequestingOtp(true)
      const res = await fetch('/api/profile/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ method }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to send OTP' }))
        throw new Error(errorData.error || 'Failed to send OTP')
      }

      const data = await res.json()
      toast.success(data.message || `OTP sent to your ${method === 'SMS' ? 'phone' : 'email'}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP')
    } finally {
      setRequestingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP code')
      return
    }

    try {
      setVerifyingOtp(true)
      const res = await fetch('/api/profile/otp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: otpCode, enabled: true }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to verify OTP' }))
        throw new Error(errorData.error || 'Failed to verify OTP')
      }

      setProfile({ ...profile, otpEnabled: true })
      setOtpCode('')
      toast.success('OTP enabled successfully')
      await fetchProfile() // Refresh profile
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify OTP')
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleToggleOtp = async (enabled: boolean) => {
    if (enabled && !profile.otpEnabled) {
      // Need to verify OTP first
      toast.error('Please verify OTP code first to enable')
      return
    }

    try {
      const res = await fetch('/api/profile/otp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update OTP settings' }))
        throw new Error(errorData.error || 'Failed to update OTP settings')
      }

      setProfile({ ...profile, otpEnabled: enabled })
      toast.success(`OTP ${enabled ? 'enabled' : 'disabled'} successfully`)
      await fetchProfile() // Refresh profile
    } catch (error: any) {
      toast.error(error.message || 'Failed to update OTP settings')
    }
  }

  const getInitials = () => {
    if (profile.name) {
      return profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (profile.email) {
      return profile.email[0].toUpperCase()
    }
    return 'U'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-gray-600 mt-1">Manage your personal information and account settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-gray-200">
                  <AvatarImage src={profile.image || undefined} alt={profile.name || profile.email} />
                  <AvatarFallback className="bg-orange-100 text-orange-600 text-xl font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">{profile.name || 'No name set'}</p>
                <p className="text-sm text-gray-500">{profile.email}</p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={uploadingImage}
                    className="text-xs"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {profile.image ? 'Change' : 'Upload'}
                  </Button>
                  {profile.image && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage}
                      className="text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="Enter your email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phoneNumber || ''}
                onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                placeholder="Enter your phone number"
              />
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                placeholder="Confirm new password"
              />
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={saving || !passwordData.currentPassword || !passwordData.newPassword}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* OTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication (OTP)
          </CardTitle>
          <CardDescription>Enable OTP verification via email or SMS for additional security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="otp-enabled" className="text-base font-medium">
                Enable OTP
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Require OTP code for login and sensitive operations
              </p>
            </div>
            <Switch
              id="otp-enabled"
              checked={profile.otpEnabled}
              onCheckedChange={handleToggleOtp}
              disabled={!profile.otpEnabled && !profile.otpMethod}
            />
          </div>

          {!profile.otpEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label>Choose OTP Method</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRequestOtp('EMAIL')}
                    disabled={requestingOtp || !profile.email}
                    className="flex-1"
                  >
                    {requestingOtp ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Send via Email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRequestOtp('SMS')}
                    disabled={requestingOtp || !profile.phoneNumber}
                    className="flex-1"
                  >
                    {requestingOtp ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Phone className="w-4 h-4 mr-2" />
                    )}
                    Send via SMS
                  </Button>
                </div>
                {!profile.email && !profile.phoneNumber && (
                  <p className="text-sm text-red-600 mt-2">
                    Please add an email or phone number to enable OTP
                  </p>
                )}
              </div>

              {profile.otpMethod && (
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Enter OTP Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="otp-code"
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || otpCode.length !== 6}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {verifyingOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Verify
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter the 6-digit code sent to your {profile.otpMethod === 'SMS' ? 'phone' : 'email'}
                  </p>
                </div>
              )}
            </div>
          )}

          {profile.otpEnabled && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">OTP is enabled</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                OTP verification is active via {profile.otpMethod === 'SMS' ? 'SMS' : 'Email'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

