'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { Save, Loader2, Send, Plus, Edit, Trash2, CheckSquare, X, RefreshCw, Download, Upload, Clock, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { useTheme } from '@/components/providers/theme-provider'

interface Settings {
  // SMS Settings
  deywuroUsername: string
  deywuroPassword: string
  deywuroSource: string
  smsEnabled: boolean

  // WhatsApp Settings
  twilioAccountSid: string
  twilioAuthToken: string
  twilioWhatsAppNumber: string
  whatsappEnabled: boolean

  // Email Settings
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPassword: string
  smtpFrom: string
  emailEnabled: boolean

  // Notification Settings
  notifyOnIssueCreated: boolean
  notifyOnIssueAssigned: boolean
  notifyOnIssueStatusChanged: boolean
  notifyOnIssueCommented: boolean
  notifyOnBookingCreated: boolean
  notifyOnBookingUpdated: boolean
  sendSmsForUrgentIssues: boolean

  // Reminder Settings
  bookingReminderHours: number
  taskReminderEnabled: boolean
  issueReminderEnabled: boolean
  paymentReminderEnabled: boolean

  // General Settings
  appUrl: string
  logo: string
  favicon: string
  themeColor: string
  fxRateGHS: string
  fxRateUSD: string
  fxRateFormat: 'ghsToUsd' | 'usdToGhs'

  // AI Provider Settings
  aiProvider: string
  openaiApiKey: string
  anthropicApiKey: string
  geminiApiKey: string
  aiModel: string
}

export function AdminSettingsPage() {
  const { setThemeColor } = useTheme()
  const [settings, setSettings] = useState<Settings>({
    deywuroUsername: '',
    deywuroPassword: '',
    deywuroSource: 'HostHub',
    smsEnabled: true,
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioWhatsAppNumber: '',
    whatsappEnabled: true,
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: '',
    emailEnabled: true,
    notifyOnIssueCreated: true,
    notifyOnIssueAssigned: true,
    notifyOnIssueStatusChanged: true,
    notifyOnIssueCommented: true,
    notifyOnBookingCreated: true,
    notifyOnBookingUpdated: true,
    sendSmsForUrgentIssues: true,
    bookingReminderHours: 24,
    taskReminderEnabled: true,
    issueReminderEnabled: true,
    paymentReminderEnabled: true,
    appUrl: '',
    logo: '',
    favicon: '',
    themeColor: '#f97316',
    fxRateGHS: '0.08',
    fxRateUSD: '1.0',
    fxRateFormat: 'ghsToUsd' as const,
    aiProvider: 'openai',
    openaiApiKey: '',
    anthropicApiKey: '',
    geminiApiKey: '',
    aiModel: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testPhoneNumber, setTestPhoneNumber] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testingSms, setTestingSms] = useState(false)
  const [testWhatsAppNumber, setTestWhatsAppNumber] = useState('')
  const [testWhatsAppMessage, setTestWhatsAppMessage] = useState('')
  const [testingWhatsApp, setTestingWhatsApp] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testEmailSubject, setTestEmailSubject] = useState('')
  const [testEmailMessage, setTestEmailMessage] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)
  const [runningReminders, setRunningReminders] = useState(false)
  const [checkingSmsHealth, setCheckingSmsHealth] = useState(false)
  const [smsHealthMessage, setSmsHealthMessage] = useState<string | null>(null)
  const [smsHealthError, setSmsHealthError] = useState<string | null>(null)
  const [checkingEmailHealth, setCheckingEmailHealth] = useState(false)
  const [emailHealthMessage, setEmailHealthMessage] = useState<string | null>(null)
  const [emailHealthError, setEmailHealthError] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  // Update theme color in real-time when it changes
  useEffect(() => {
    if (settings.themeColor && /^#[0-9A-Fa-f]{6}$/.test(settings.themeColor)) {
      setThemeColor(settings.themeColor)
    }
  }, [settings.themeColor, setThemeColor])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) {
        throw new Error('Failed to fetch settings')
      }
      const data = await res.json()
      
      // Map settings from API to state
      const mappedSettings: Settings = {
        deywuroUsername: data.DEYWURO_USERNAME || '',
        deywuroPassword: data.DEYWURO_PASSWORD || '',
        deywuroSource: data.DEYWURO_SOURCE || 'HostHub',
        smsEnabled: data.SMS_ENABLED !== false,
        twilioAccountSid: data.TWILIO_ACCOUNT_SID || '',
        twilioAuthToken: data.TWILIO_AUTH_TOKEN || '',
        twilioWhatsAppNumber: data.TWILIO_WHATSAPP_NUMBER || '',
        whatsappEnabled: data.WHATSAPP_ENABLED !== false,
        smtpHost: data.SMTP_HOST || '',
        smtpPort: data.SMTP_PORT || '587',
        smtpUser: data.SMTP_USER || '',
        smtpPassword: data.SMTP_PASSWORD || '',
        smtpFrom: data.SMTP_FROM || '',
        emailEnabled: data.EMAIL_ENABLED !== false,
        notifyOnIssueCreated: data.NOTIFY_ON_ISSUE_CREATED !== false,
        notifyOnIssueAssigned: data.NOTIFY_ON_ISSUE_ASSIGNED !== false,
      notifyOnIssueStatusChanged: data.NOTIFY_ON_ISSUE_STATUS_CHANGED !== false,
      notifyOnIssueCommented: data.NOTIFY_ON_ISSUE_COMMENTED !== false,
      notifyOnBookingCreated: data.NOTIFY_ON_BOOKING_CREATED !== false,
      notifyOnBookingUpdated: data.NOTIFY_ON_BOOKING_UPDATED !== false,
      sendSmsForUrgentIssues: data.SEND_SMS_FOR_URGENT_ISSUES !== false,
      bookingReminderHours: Number.isFinite(parseInt(data.BOOKING_REMINDER_HOURS)) ? parseInt(data.BOOKING_REMINDER_HOURS) : 24,
      taskReminderEnabled: data.TASK_REMINDER_ENABLED !== 'false',
      issueReminderEnabled: data.ISSUE_REMINDER_ENABLED !== 'false',
      paymentReminderEnabled: data.PAYMENT_REMINDER_ENABLED !== 'false',
      appUrl: data.NEXT_PUBLIC_APP_URL || '',
      logo: data.APP_LOGO || '',
      favicon: data.APP_FAVICON || '',
      themeColor: data.THEME_COLOR || '#f97316',
      fxRateGHS: data.FX_RATE_GHS || '0.08',
      fxRateUSD: data.FX_RATE_USD || '1.0',
      fxRateFormat: (data.FX_RATE_FORMAT as 'ghsToUsd' | 'usdToGhs') || 'ghsToUsd',
      aiProvider: data.AI_PROVIDER || 'openai',
      openaiApiKey: data.OPENAI_API_KEY || '',
      anthropicApiKey: data.ANTHROPIC_API_KEY || '',
      geminiApiKey: data.GEMINI_API_KEY || '',
      aiModel: data.AI_MODEL || '',
    }
      setSettings(mappedSettings)
    } catch (error: any) {
      console.error('Failed to fetch settings:', error)
      toast.error('Failed to load settings', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      toast.success('Settings saved', 'Your settings have been saved successfully')
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings', error.message)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof Settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleTestWhatsApp = async () => {
    if (!testWhatsAppNumber.trim()) {
      toast.error('WhatsApp number required', 'Please enter a WhatsApp number to test')
      return
    }

    if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioWhatsAppNumber) {
      toast.error('Credentials not configured', 'Please enter your Twilio Account SID, Auth Token, and WhatsApp number in the configuration section above before testing.')
      return
    }

    try {
      setTestingWhatsApp(true)
      const res = await fetch('/api/settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: testWhatsAppNumber,
          message: testWhatsAppMessage || undefined,
          credentials: {
            accountSid: settings.twilioAccountSid,
            authToken: settings.twilioAuthToken,
            fromNumber: settings.twilioWhatsAppNumber,
            whatsappEnabled: settings.whatsappEnabled,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test WhatsApp')
      }

      toast.success('Test WhatsApp sent', data.message || 'Test WhatsApp message sent successfully')
      setTestWhatsAppNumber('')
      setTestWhatsAppMessage('')
    } catch (error: any) {
      console.error('Failed to send test WhatsApp:', error)
      toast.error('Failed to send test WhatsApp', error.message)
    } finally {
      setTestingWhatsApp(false)
    }
  }

  const handleTestSMS = async () => {
    if (!testPhoneNumber.trim()) {
      toast.error('Phone number required', 'Please enter a phone number to test')
      return
    }

    if (!settings.deywuroUsername || !settings.deywuroPassword) {
      toast.error('Credentials not configured', 'Please enter your Deywuro username and password in the configuration section above before testing.')
      return
    }

    try {
      setTestingSms(true)
      const res = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: testPhoneNumber,
          message: testMessage || undefined,
          credentials: {
            username: settings.deywuroUsername,
            password: settings.deywuroPassword,
            source: settings.deywuroSource,
            smsEnabled: settings.smsEnabled,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test SMS')
      }

      toast.success('Test SMS sent', data.message || 'Test SMS sent successfully')
      setTestPhoneNumber('')
      setTestMessage('')
    } catch (error: any) {
      console.error('Failed to send test SMS:', error)
      toast.error('Failed to send test SMS', error.message)
    } finally {
      setTestingSms(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Email address required', 'Please enter an email address to test')
      return
    }

    try {
      setTestingEmail(true)
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          subject: testEmailSubject || undefined,
          message: testEmailMessage || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      toast.success('Test email sent', data.message || 'Test email sent successfully')
      setTestEmail('')
      setTestEmailSubject('')
      setTestEmailMessage('')
    } catch (error: any) {
      console.error('Failed to send test email:', error)
      toast.error('Failed to send test email', error.message)
    } finally {
      setTestingEmail(false)
    }
  }

  const handleRunReminders = async () => {
    try {
      setRunningReminders(true)
      const res = await fetch('/api/reminders/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run reminders')
      }
      toast.success(
        'Reminders run',
        `Bookings: ${data.results?.bookings?.sent ?? 0}, Tasks: ${data.results?.tasks?.sent ?? 0}, Issues: ${data.results?.issues?.sent ?? 0}`
      )
    } catch (error: any) {
      console.error('Failed to run reminders:', error)
      toast.error('Failed to run reminders', error.message)
    } finally {
      setRunningReminders(false)
    }
  }

  const handleSmsHealthCheck = async () => {
    if (!settings.deywuroUsername || !settings.deywuroPassword) {
      toast.error('Credentials required', 'Enter Deywuro username and password first.')
      return
    }
    setSmsHealthMessage(null)
    setSmsHealthError(null)
    try {
      setCheckingSmsHealth(true)
      const res = await fetch('/api/sms/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: {
            username: settings.deywuroUsername,
            password: settings.deywuroPassword,
            source: settings.deywuroSource,
            smsEnabled: settings.smsEnabled,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'SMS health check failed')
      }
      setSmsHealthMessage(data.message || 'SMS credentials look good')
      toast.success('SMS health check passed', data.message || 'Credentials verified')
    } catch (error: any) {
      console.error('SMS health check error:', error)
      setSmsHealthError(error.message)
      toast.error('SMS health check failed', error.message)
    } finally {
      setCheckingSmsHealth(false)
    }
  }

  const handleEmailHealthCheck = async () => {
    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
      toast.error('SMTP details required', 'Fill host, port, user, and password first.')
      return
    }
    setEmailHealthMessage(null)
    setEmailHealthError(null)
    try {
      setCheckingEmailHealth(true)
      const res = await fetch('/api/email/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPassword: settings.smtpPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'SMTP health check failed')
      }
      setEmailHealthMessage(data.message || 'SMTP connection verified')
      toast.success('SMTP health check passed', data.message || 'Connection verified')
    } catch (error: any) {
      console.error('SMTP health check error:', error)
      setEmailHealthError(error.message)
      toast.error('SMTP health check failed', error.message)
    } finally {
      setCheckingEmailHealth(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage application settings and configurations</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="hover:opacity-90" style={{ backgroundColor: 'var(--theme-color, #f97316)' }}>
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
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="sms">SMS (Deywuro)</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp (Twilio)</TabsTrigger>
          <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
          <TabsTrigger value="ai">AI Providers</TabsTrigger>
          <TabsTrigger value="cleaning-checklists">Cleaning Checklists</TabsTrigger>
          <TabsTrigger value="backup-restore">Backup & Restore</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure when and how notifications are sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Issue Created</Label>
                  <p className="text-sm text-gray-500">Send notification when a new issue is created</p>
                </div>
                <Switch
                  checked={settings.notifyOnIssueCreated}
                  onCheckedChange={(checked) => updateSetting('notifyOnIssueCreated', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Issue Assigned</Label>
                  <p className="text-sm text-gray-500">Send notification when an issue is assigned</p>
                </div>
                <Switch
                  checked={settings.notifyOnIssueAssigned}
                  onCheckedChange={(checked) => updateSetting('notifyOnIssueAssigned', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Issue Status Changed</Label>
                  <p className="text-sm text-gray-500">Send notification when issue status is updated</p>
                </div>
                <Switch
                  checked={settings.notifyOnIssueStatusChanged}
                  onCheckedChange={(checked) => updateSetting('notifyOnIssueStatusChanged', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Issue Commented</Label>
                  <p className="text-sm text-gray-500">Send notification when a comment is added to an issue</p>
                </div>
                <Switch
                  checked={settings.notifyOnIssueCommented}
                  onCheckedChange={(checked) => updateSetting('notifyOnIssueCommented', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Booking Created</Label>
                  <p className="text-sm text-gray-500">Send notification when a new booking is created</p>
                </div>
                <Switch
                  checked={settings.notifyOnBookingCreated}
                  onCheckedChange={(checked) => updateSetting('notifyOnBookingCreated', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Booking Updated</Label>
                  <p className="text-sm text-gray-500">Send notification when a booking is updated</p>
                </div>
                <Switch
                  checked={settings.notifyOnBookingUpdated}
                  onCheckedChange={(checked) => updateSetting('notifyOnBookingUpdated', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Send SMS for Urgent Issues</Label>
                  <p className="text-sm text-gray-500">Automatically send SMS for urgent and high priority issues</p>
                </div>
                <Switch
                  checked={settings.sendSmsForUrgentIssues}
                  onCheckedChange={(checked) => updateSetting('sendSmsForUrgentIssues', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automated Reminders</CardTitle>
              <CardDescription>Configure automated reminder settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bookingReminderHours">Booking Reminder (Hours Before Check-in)</Label>
                <Input
                  id="bookingReminderHours"
                  type="number"
                  min="1"
                  max="168"
                  value={settings.bookingReminderHours}
                  onChange={(e) => updateSetting('bookingReminderHours', parseInt(e.target.value) || 24)}
                />
                <p className="text-sm text-gray-500">
                  Send reminder this many hours before check-in (default: 24 hours)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Task Reminders</Label>
                  <p className="text-sm text-gray-500">Send reminders for overdue tasks</p>
                </div>
                <Switch
                  checked={settings.taskReminderEnabled}
                  onCheckedChange={(checked) => updateSetting('taskReminderEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Issue Reminders</Label>
                  <p className="text-sm text-gray-500">Send reminders for pending issues (older than 2 days)</p>
                </div>
                <Switch
                  checked={settings.issueReminderEnabled}
                  onCheckedChange={(checked) => updateSetting('issueReminderEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Payment Reminders</Label>
                  <p className="text-sm text-gray-500">Send reminders for payment due dates</p>
                </div>
                <Switch
                  checked={settings.paymentReminderEnabled}
                  onCheckedChange={(checked) => updateSetting('paymentReminderEnabled', checked)}
                />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Note:</strong> Reminders are sent automatically via a scheduled job. 
                  You can manually trigger reminders by calling <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/api/reminders/run</code>
                </p>
                <p className="text-xs text-gray-500">
                  For production, set up a cron job (e.g., Vercel Cron) to call this endpoint hourly.
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRunReminders}
                    disabled={runningReminders}
                  >
                    {runningReminders ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      'Run Reminders Now'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMS Configuration (Deywuro)</CardTitle>
              <CardDescription>Configure Deywuro SMS API settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label>Enable SMS</Label>
                  <p className="text-sm text-gray-500">Enable SMS notifications via Deywuro</p>
                </div>
                <Switch
                  checked={settings.smsEnabled}
                  onCheckedChange={(checked) => updateSetting('smsEnabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deywuroUsername">Deywuro Username</Label>
                <Input
                  id="deywuroUsername"
                  type="text"
                  value={settings.deywuroUsername}
                  onChange={(e) => updateSetting('deywuroUsername', e.target.value)}
                  placeholder="Enter your Deywuro username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deywuroPassword">Deywuro Password</Label>
                <Input
                  id="deywuroPassword"
                  type="password"
                  value={settings.deywuroPassword}
                  onChange={(e) => updateSetting('deywuroPassword', e.target.value)}
                  placeholder="Enter your Deywuro password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deywuroSource">Sender ID (Source)</Label>
                <Input
                  id="deywuroSource"
                  type="text"
                  value={settings.deywuroSource}
                  onChange={(e) => updateSetting('deywuroSource', e.target.value.substring(0, 11))}
                  placeholder="HostHub"
                  maxLength={11}
                />
                <p className="text-sm text-gray-500">Max 11 characters, alphanumeric only</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test SMS</CardTitle>
              <CardDescription>Send a test SMS to verify your configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testPhoneNumber">Phone Number</Label>
                <Input
                  id="testPhoneNumber"
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="233XXXXXXXXX or 0XXXXXXXXX"
                />
                <p className="text-sm text-gray-500">
                  Enter phone number with country code (e.g., 233XXXXXXXXX) or local format (0XXXXXXXXX)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testMessage">Test Message (Optional)</Label>
                <Input
                  id="testMessage"
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Leave empty to use default test message"
                />
              </div>

              <Button
                onClick={handleTestSMS}
                disabled={testingSms || !testPhoneNumber.trim()}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {testingSms ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test SMS
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SMS Health Check</CardTitle>
              <CardDescription>Validate Deywuro credentials without sending an SMS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleSmsHealthCheck}
                disabled={checkingSmsHealth}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {checkingSmsHealth ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Run SMS Health Check'
                )}
              </Button>
              {smsHealthMessage && (
                <p className="text-sm text-green-600">{smsHealthMessage}</p>
              )}
              {smsHealthError && (
                <p className="text-sm text-red-600">{smsHealthError}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Configuration (Twilio)</CardTitle>
              <CardDescription>Configure Twilio WhatsApp API settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label>Enable WhatsApp</Label>
                  <p className="text-sm text-gray-500">Enable WhatsApp notifications via Twilio</p>
                </div>
                <Switch
                  checked={settings.whatsappEnabled}
                  onCheckedChange={(checked) => updateSetting('whatsappEnabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
                <Input
                  id="twilioAccountSid"
                  type="text"
                  value={settings.twilioAccountSid}
                  onChange={(e) => updateSetting('twilioAccountSid', e.target.value)}
                  placeholder="Enter your Twilio Account SID"
                />
                <p className="text-sm text-gray-500">
                  Find this in your Twilio Console → Account → Account SID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
                <Input
                  id="twilioAuthToken"
                  type="password"
                  value={settings.twilioAuthToken}
                  onChange={(e) => updateSetting('twilioAuthToken', e.target.value)}
                  placeholder="Enter your Twilio Auth Token"
                />
                <p className="text-sm text-gray-500">
                  Find this in your Twilio Console → Account → Auth Token
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilioWhatsAppNumber">WhatsApp Number</Label>
                <Input
                  id="twilioWhatsAppNumber"
                  type="text"
                  value={settings.twilioWhatsAppNumber}
                  onChange={(e) => updateSetting('twilioWhatsAppNumber', e.target.value)}
                  placeholder="whatsapp:+14155238886 or +14155238886"
                />
                <p className="text-sm text-gray-500">
                  Your Twilio WhatsApp-enabled number. For testing, use Twilio sandbox: <code className="bg-gray-100 px-1 rounded">whatsapp:+14155238886</code> or <code className="bg-gray-100 px-1 rounded">+14155238886</code>
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Make sure the number is approved in Twilio Console → Messaging → Try it out
                </p>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-1">📋 About WhatsApp Templates:</p>
                  <p className="text-xs text-blue-800">
                    Messages outside the 24-hour window require pre-approved templates. 
                    Create templates in Twilio Console → Content → Templates, then add Content SIDs to <code className="bg-blue-100 px-1 rounded text-xs">lib/notifications/whatsapp-templates.ts</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test WhatsApp</CardTitle>
              <CardDescription>Send a test WhatsApp message to verify your configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testWhatsAppNumber">WhatsApp Number</Label>
                <Input
                  id="testWhatsAppNumber"
                  type="tel"
                  value={testWhatsAppNumber}
                  onChange={(e) => setTestWhatsAppNumber(e.target.value)}
                  placeholder="+233XXXXXXXXX or 0XXXXXXXXX"
                />
                <p className="text-sm text-gray-500">
                  Enter phone number with country code (e.g., +233XXXXXXXXX) or local format (0XXXXXXXXX)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testWhatsAppMessage">Test Message (Optional)</Label>
                <Input
                  id="testWhatsAppMessage"
                  type="text"
                  value={testWhatsAppMessage}
                  onChange={(e) => setTestWhatsAppMessage(e.target.value)}
                  placeholder="Leave empty to use default test message"
                />
              </div>

              <Button
                onClick={handleTestWhatsApp}
                disabled={testingWhatsApp || !testWhatsAppNumber.trim()}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {testingWhatsApp ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test WhatsApp
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration (SMTP)</CardTitle>
              <CardDescription>Configure Hostinger SMTP settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label>Enable Email</Label>
                  <p className="text-sm text-gray-500">Enable email notifications via SMTP</p>
                </div>
                <Switch
                  checked={settings.emailEnabled}
                  onCheckedChange={(checked) => updateSetting('emailEnabled', checked)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    type="text"
                    value={settings.smtpHost}
                    onChange={(e) => updateSetting('smtpHost', e.target.value)}
                    placeholder="smtp.hostinger.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="text"
                    value={settings.smtpPort}
                    onChange={(e) => updateSetting('smtpPort', e.target.value)}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUser">SMTP Username</Label>
                <Input
                  id="smtpUser"
                  type="text"
                  value={settings.smtpUser}
                  onChange={(e) => updateSetting('smtpUser', e.target.value)}
                  placeholder="your_email@yourdomain.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPassword">SMTP Password</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  value={settings.smtpPassword}
                  onChange={(e) => updateSetting('smtpPassword', e.target.value)}
                  placeholder="Enter your SMTP password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpFrom">From Email Address</Label>
                <Input
                  id="smtpFrom"
                  type="email"
                  value={settings.smtpFrom}
                  onChange={(e) => updateSetting('smtpFrom', e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Email</CardTitle>
              <CardDescription>Send a test email to verify your SMTP configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testEmail">Email Address</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testEmailSubject">Subject (Optional)</Label>
                <Input
                  id="testEmailSubject"
                  type="text"
                  value={testEmailSubject}
                  onChange={(e) => setTestEmailSubject(e.target.value)}
                  placeholder="Leave empty to use default subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testEmailMessage">Message (Optional)</Label>
                <Input
                  id="testEmailMessage"
                  type="text"
                  value={testEmailMessage}
                  onChange={(e) => setTestEmailMessage(e.target.value)}
                  placeholder="Leave empty to use default message"
                />
              </div>

              <Button
                onClick={handleTestEmail}
                disabled={testingEmail || !testEmail.trim()}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {testingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Health Check</CardTitle>
              <CardDescription>Validate SMTP connectivity without sending email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleEmailHealthCheck}
                disabled={checkingEmailHealth}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {checkingEmailHealth ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Run Email Health Check'
                )}
              </Button>
              {emailHealthMessage && (
                <p className="text-sm text-green-600">{emailHealthMessage}</p>
              )}
              {emailHealthError && (
                <p className="text-sm text-red-600">{emailHealthError}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
              <CardDescription>Configure AI provider for insights, forecasts, and marketing strategies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiProvider">AI Provider</Label>
                <Select
                  value={settings.aiProvider}
                  onValueChange={(value) => updateSetting('aiProvider', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4, GPT-3.5)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">Choose which AI provider to use for all AI features</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiModel">Model (Optional)</Label>
                <Input
                  id="aiModel"
                  type="text"
                  value={settings.aiModel}
                  onChange={(e) => updateSetting('aiModel', e.target.value)}
                  placeholder="Leave empty for default model"
                />
                <p className="text-sm text-gray-500">
                  Default models: OpenAI (gpt-4o-mini), Anthropic (claude-3-5-sonnet-20241022), Gemini (gemini-1.5-flash)
                </p>
                <div className="mt-2 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-900">
                    <strong>Valid models:</strong>
                    <br />
                    <strong>OpenAI:</strong> gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
                    <br />
                    <strong>Anthropic:</strong> claude-3-5-sonnet-20241022, claude-3-5-sonnet-20240620, claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307
                    <br />
                    <strong>Gemini:</strong> gemini-1.5-flash, gemini-1.5-pro, gemini-pro
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-sm text-gray-500">
                  Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    OpenAI Platform
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anthropicApiKey">Anthropic API Key</Label>
                <Input
                  id="anthropicApiKey"
                  type="password"
                  value={settings.anthropicApiKey}
                  onChange={(e) => updateSetting('anthropicApiKey', e.target.value)}
                  placeholder="sk-ant-..."
                />
                <p className="text-sm text-gray-500">
                  Get your API key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Anthropic Console
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geminiApiKey">Google Gemini API Key</Label>
                <Input
                  id="geminiApiKey"
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                  placeholder="AIza..."
                />
                <p className="text-sm text-gray-500">
                  Get your API key from{' '}
                  <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Only the API key for the selected provider is required. 
                  You can add keys for all providers and switch between them anytime.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleaning-checklists" className="space-y-4">
          <CleaningChecklistsManager />
        </TabsContent>

        <TabsContent value="backup-restore" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore</CardTitle>
              <CardDescription>
                Create backups of your data or restore from a previous backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Create Backup</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Download a complete backup of all your data. This includes all properties, bookings, expenses, statements, and more.
                    Sensitive credentials (passwords, API keys) are excluded for security.
                  </p>
                  <Button
                    onClick={async () => {
                      setBackingUp(true)
                      try {
                        const res = await fetch('/api/admin/backup')
                        if (!res.ok) {
                          const error = await res.json()
                          throw new Error(error.error || 'Failed to create backup')
                        }
                        const blob = await res.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        const contentDisposition = res.headers.get('Content-Disposition')
                        const filename = contentDisposition
                          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
                          : `hosthub-backup-${new Date().toISOString().split('T')[0]}.json`
                        a.download = filename
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                        toast.success('Backup created', 'Your backup has been downloaded successfully')
                      } catch (error: any) {
                        console.error('Backup error:', error)
                        toast.error('Backup failed', error.message)
                      } finally {
                        setBackingUp(false)
                      }
                    }}
                    disabled={backingUp}
                    className="w-full sm:w-auto"
                  >
                    {backingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Backup...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Backup
                      </>
                    )}
                  </Button>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-2">Restore Backup</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Restore your data from a previous backup file. This will replace all existing data with the backup data.
                    <strong className="text-red-600"> This action cannot be undone!</strong>
                  </p>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="backupFile">Select Backup File</Label>
                      {restoring && (
                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg mb-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-sm text-blue-700">Restoring backup... This may take a moment.</span>
                        </div>
                      )}
                      <Input
                        id="backupFile"
                        type="file"
                        disabled={restoring}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          console.log('Restore: File selected:', file.name, 'Type:', file.type, 'Size:', file.size)

                          try {
                            const fileName = file.name.toLowerCase()
                            const isArchive = fileName.endsWith('.tar.gz') || fileName.endsWith('.zip') || fileName.endsWith('.gz')
                            const isJSON = fileName.endsWith('.json')

                            console.log('Restore: isArchive:', isArchive, 'isJSON:', isJSON)

                            if (!isArchive && !isJSON) {
                              toast.error('Invalid backup file', 'Please select a .json, .tar.gz, or .zip backup file')
                              console.error('Invalid file type:', fileName)
                              e.target.value = ''
                              return
                            }

                            let confirmed = false
                            let clearExisting = false

                            if (isJSON) {
                              // For JSON files, parse and show details
                              const text = await file.text()
                              const backup = JSON.parse(text)

                              if (!backup.data || !backup.version) {
                                toast.error('Invalid backup file', 'The selected file is not a valid backup')
                                e.target.value = ''
                                return
                              }

                              confirmed = confirm(
                                `Are you sure you want to restore this backup?\n\n` +
                                `Created: ${backup.createdAt || 'Unknown'}\n` +
                                `Version: ${backup.version}\n\n` +
                                `This will replace ALL existing data. This action cannot be undone!\n\n` +
                                `Do you want to clear existing data before restoring?`
                              )

                              if (!confirmed) {
                                e.target.value = ''
                                return
                              }

                              clearExisting = confirm(
                                'Clear all existing data before restoring? (Recommended for clean restore)'
                              )
                            } else {
                              // For archive files, just confirm
                              confirmed = confirm(
                                `Are you sure you want to restore this backup?\n\n` +
                                `File: ${file.name}\n\n` +
                                `This will replace ALL existing data. This action cannot be undone!\n\n` +
                                `Do you want to clear existing data before restoring?`
                              )

                              if (!confirmed) {
                                e.target.value = ''
                                return
                              }

                              clearExisting = confirm(
                                'Clear all existing data before restoring? (Recommended for clean restore)'
                              )
                            }

                            setRestoring(true)
                            console.log('Restore: Starting restore, isArchive:', isArchive, 'clearExisting:', clearExisting)

                            let res: Response
                            if (isArchive) {
                              // Send archive as file upload
                              const formData = new FormData()
                              formData.append('file', file)
                              if (clearExisting) {
                                formData.append('clearExisting', 'true')
                              }

                              console.log('Restore: Sending archive via FormData')
                              res = await fetch('/api/admin/restore', {
                                method: 'POST',
                                body: formData,
                              })
                              console.log('Restore: Archive response status:', res.status)
                            } else {
                              // Send JSON in body (backward compatibility)
                              const text = await file.text()
                              const backup = JSON.parse(text)

                              console.log('Restore: Sending JSON backup')
                              res = await fetch('/api/admin/restore', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ backup, clearExisting }),
                              })
                              console.log('Restore: JSON response status:', res.status)
                            }

                            const data = await res.json()
                            console.log('Restore: Response data:', data)

                            if (!res.ok) {
                              throw new Error(data.error || 'Failed to restore backup')
                            }

                            toast.success('Backup restored', data.message || 'Your data has been restored successfully')
                            // Reset file input
                            e.target.value = ''
                          } catch (error: any) {
                            console.error('Restore error:', error)
                            toast.error('Restore failed', error.message)
                          } finally {
                            setRestoring(false)
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure general application settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appUrl">Application URL</Label>
                <Input
                  id="appUrl"
                  type="url"
                  value={settings.appUrl}
                  onChange={(e) => updateSetting('appUrl', e.target.value)}
                  placeholder="https://yourdomain.com"
                />
                <p className="text-sm text-gray-500">Used for notification links</p>
              </div>
              
              <div className="space-y-2">
                <Label>Application Logo</Label>
                <div className="flex items-center gap-4">
                  {settings.logo && (
                    <div className="relative">
                      <img 
                        src={settings.logo} 
                        alt="Logo" 
                        className="h-16 w-auto object-contain border rounded p-2 bg-white"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error('File too large', 'Logo must be less than 5MB')
                          return
                        }
                        
                        const formData = new FormData()
                        formData.append('logo', file)
                        
                        try {
                          const res = await fetch('/api/settings/logo', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include',
                          })
                          
                          if (!res.ok) {
                            const error = await res.json()
                            throw new Error(error.error || 'Failed to upload logo')
                          }
                          
                          const data = await res.json()
                          updateSetting('logo', data.logoUrl)
                          toast.success('Logo uploaded', 'Logo has been uploaded successfully')
                        } catch (error: any) {
                          console.error('Logo upload error:', error)
                          toast.error('Upload failed', error.message)
                        }
                      }}
                    />
                    <p className="text-sm text-gray-500 mt-1">Upload your company logo (PNG, JPG, WebP, max 5MB)</p>
                    {settings.logo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/settings/logo', {
                              method: 'DELETE',
                              credentials: 'include',
                            })
                            
                            if (!res.ok) {
                              throw new Error('Failed to delete logo')
                            }
                            
                            updateSetting('logo', '')
                            toast.success('Logo removed', 'Logo has been removed')
                          } catch (error: any) {
                            console.error('Logo delete error:', error)
                            toast.error('Delete failed', error.message)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Logo
                      </Button>
                    )}
                  </div>
                </div>

                {/* Favicon Upload */}
                <div className="space-y-2">
                  <Label>Favicon (Browser Tab Icon)</Label>
                  <div className="flex items-start gap-4">
                    {settings.favicon && (
                      <div className="flex items-center gap-2">
                        <img 
                          src={settings.favicon} 
                          alt="Favicon" 
                          className="w-16 h-16 object-contain border rounded p-2 bg-white"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('File too large', 'Favicon must be less than 2MB')
                            return
                          }

                          const formData = new FormData()
                          formData.append('favicon', file)

                          try {
                            const res = await fetch('/api/settings/favicon', {
                              method: 'POST',
                              body: formData,
                              credentials: 'include',
                            })

                            const data = await res.json()

                            if (!res.ok) {
                              throw new Error(data.error || 'Failed to upload favicon')
                            }

                            updateSetting('favicon', data.faviconUrl)
                            toast.success('Favicon uploaded', 'Favicon has been uploaded successfully. Please refresh the page to see it in the browser tab.')
                          } catch (error: any) {
                            console.error('Favicon upload error:', error)
                            toast.error('Failed to upload favicon', error.message)
                          }
                        }}
                      />
                      <p className="text-sm text-gray-500 mt-1">Upload your favicon (ICO, PNG, or SVG, max 2MB). This appears in browser tabs.</p>
                      {settings.favicon && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/settings/favicon', {
                                method: 'DELETE',
                                credentials: 'include',
                              })
                              if (!res.ok) {
                                throw new Error('Failed to delete favicon')
                              }
                              updateSetting('favicon', '')
                              toast.success('Favicon deleted', 'Favicon has been removed. Please refresh the page.')
                            } catch (error: any) {
                              toast.error('Failed to delete favicon', error.message)
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove Favicon
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">Theme Color</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Choose a primary accent color for your application. This color will be used for buttons, links, and highlights throughout the system.
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <input
                      type="color"
                      value={settings.themeColor}
                      onChange={(e) => updateSetting('themeColor', e.target.value)}
                      className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-200 hover:border-gray-300 transition-colors"
                      style={{ padding: '2px' }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="themeColorHex">Hex Code</Label>
                      <Input
                        id="themeColorHex"
                        type="text"
                        value={settings.themeColor}
                        onChange={(e) => {
                          const value = e.target.value
                          if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                            updateSetting('themeColor', value || '#')
                          }
                        }}
                        placeholder="#f97316"
                        className="w-32 font-mono"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Orange', color: '#f97316' },
                        { name: 'Blue', color: '#3b82f6' },
                        { name: 'Green', color: '#22c55e' },
                        { name: 'Purple', color: '#8b5cf6' },
                        { name: 'Red', color: '#ef4444' },
                        { name: 'Pink', color: '#ec4899' },
                        { name: 'Teal', color: '#14b8a6' },
                        { name: 'Indigo', color: '#6366f1' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => updateSetting('themeColor', preset.color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                            settings.themeColor === preset.color 
                              ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' 
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">Click a preset or use the color picker for custom colors</p>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-lg border bg-gray-50">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-white rounded-md text-sm font-medium"
                      style={{ backgroundColor: settings.themeColor }}
                    >
                      Primary Button
                    </button>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: settings.themeColor }}
                    >
                      Accent Text
                    </span>
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: settings.themeColor }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">Exchange Rates</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Set exchange rates for currency conversion. These rates will only apply to new bookings and expenses created after saving.
                  Existing bookings will keep their original exchange rates. Dashboard calculations use historical rates from each booking.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fxRateUSD">USD Rate (Base Currency)</Label>
                    <Input
                      id="fxRateUSD"
                      type="number"
                      step="0.0001"
                      value={settings.fxRateUSD}
                      onChange={(e) => updateSetting('fxRateUSD', e.target.value)}
                      placeholder="1.0"
                      disabled
                    />
                    <p className="text-sm text-gray-500">1 USD = {settings.fxRateUSD || '1.0'} USD (always 1.0)</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="fxRateGHS">GHS Rate</Label>
                      <select
                        id="fxRateFormat"
                        value={settings.fxRateFormat || 'ghsToUsd'}
                        onChange={(e) => {
                          const format = e.target.value
                          const currentValue = parseFloat(settings.fxRateGHS || '0.08')
                          let newValue = currentValue
                          
                          if (format === 'usdToGhs' && currentValue < 1) {
                            // Convert from GHS→USD to USD→GHS
                            newValue = 1 / currentValue
                          } else if (format === 'ghsToUsd' && currentValue > 1) {
                            // Convert from USD→GHS to GHS→USD
                            newValue = 1 / currentValue
                          }
                          
                          updateSetting('fxRateFormat', format)
                          updateSetting('fxRateGHS', newValue.toFixed(4))
                        }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="ghsToUsd">1 GHS = X USD</option>
                        <option value="usdToGhs">1 USD = X GHS</option>
                      </select>
                    </div>
                    <Input
                      id="fxRateGHS"
                      type="number"
                      step="0.0001"
                      value={settings.fxRateGHS}
                      onChange={(e) => updateSetting('fxRateGHS', e.target.value)}
                      placeholder={settings.fxRateFormat === 'usdToGhs' ? '11.5' : '0.08'}
                    />
                    <p className="text-sm text-gray-500">
                      {settings.fxRateFormat === 'usdToGhs' 
                        ? `1 USD = ${settings.fxRateGHS || '11.5'} GHS`
                        : `1 GHS = ${settings.fxRateGHS || '0.08'} USD`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-4">
          <DiagnosticsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Diagnostics Tab Component
function DiagnosticsTab() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [testingAIReports, setTestingAIReports] = useState(false)
  const [sendingAIReports, setSendingAIReports] = useState(false)
  const [aiReportTestResult, setAiReportTestResult] = useState<any>(null)
  const [aiReportSendResult, setAiReportSendResult] = useState<any>(null)
  const [showSendConfirmDialog, setShowSendConfirmDialog] = useState(false)
  const [sendReportType, setSendReportType] = useState<'owners' | 'company'>('owners')
  const [sendReportPeriod, setSendReportPeriod] = useState<'yesterday' | 'last-week' | 'last-month' | 'current-year'>('last-week')
  const [settingUpCron, setSettingUpCron] = useState(false)
  const [cronStatus, setCronStatus] = useState<any>(null)
  const [cronSetupResult, setCronSetupResult] = useState<any>(null)

  const runDiagnostics = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/diagnostics/notifications-ai', {
        credentials: 'include',
      })
      
      if (!res.ok) {
        throw new Error('Failed to run diagnostics')
      }
      
      const data = await res.json()
      setResults(data.results || [])
      setSummary(data.summary || {})
    } catch (error: any) {
      console.error('Diagnostics error:', error)
      toast.error('Diagnostics failed', error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runDiagnostics()
    checkCronStatus()
  }, [])

  const checkCronStatus = async () => {
    try {
      const res = await fetch('/api/admin/setup-cron', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCronStatus(data)
      }
    } catch (error) {
      // Silently fail - cron check is optional
    }
  }

  const setupCronJobs = async () => {
    try {
      setSettingUpCron(true)
      setCronSetupResult(null)
      const res = await fetch('/api/admin/setup-cron', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCronSetupResult({ success: true, message: data.message, output: data.output })
        toast.success('Cron Jobs Setup', 'Cron jobs have been set up successfully!')
        await checkCronStatus()
      } else {
        setCronSetupResult({ success: false, message: data.message, instructions: data.instructions, error: data.error })
        toast.error('Cron Setup', data.message || 'Failed to set up cron jobs. See instructions below.')
      }
    } catch (error: any) {
      console.error('Cron setup error:', error)
      setCronSetupResult({ success: false, error: error.message })
      toast.error('Cron Setup Failed', error.message)
    } finally {
      setSettingUpCron(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'fail':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return '✓'
      case 'fail':
        return '✗'
      case 'warning':
        return '⚠'
      default:
        return '•'
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Diagnostics</CardTitle>
              <CardDescription>
                Check notification and AI system health and configuration
              </CardDescription>
            </div>
            <Button onClick={runDiagnostics} disabled={loading} variant="outline">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Diagnostics
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                <div className="text-sm text-green-700">Passed</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
                <div className="text-sm text-yellow-700">Warnings</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{summary.total}</div>
                <div className="text-sm text-gray-700">Total Checks</div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {results.map((result, index) => (
              <Card key={index} className={`border-2 ${getStatusColor(result.status)}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold">{getStatusIcon(result.status)}</span>
                        <span className="font-semibold">{result.check}</span>
                        <Badge variant="outline" className="ml-2">
                          {result.category}
                        </Badge>
                      </div>
                      <p className="text-sm mt-1">{result.message}</p>
                      {result.details && (
                        <div className="mt-2 text-xs opacity-75">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(result.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {results.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              Click "Run Diagnostics" to check system health
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Reports Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Reports Management</CardTitle>
          <CardDescription>
            Test and manually send AI reports to owners
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Button */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Test Reports</h4>
              <Button
                onClick={async () => {
                  try {
                    setTestingAIReports(true)
                    setAiReportTestResult(null)
                    const res = await fetch('/api/ai-reports/execute', {
                      method: 'POST',
                      credentials: 'include',
                    })
                    const data = await res.json()
                    if (res.ok) {
                      setAiReportTestResult(data)
                      toast.success('AI Reports Test', `Executed ${data.executed} reports: ${data.success} succeeded, ${data.failed} failed`)
                    } else {
                      throw new Error(data.error || 'Failed to execute AI reports')
                    }
                  } catch (error: any) {
                    console.error('AI reports test error:', error)
                    toast.error('AI Reports Test Failed', error.message)
                    setAiReportTestResult({ error: error.message })
                  } finally {
                    setTestingAIReports(false)
                  }
                }}
                disabled={testingAIReports || sendingAIReports}
                variant="outline"
                className="w-full"
              >
                {testingAIReports ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Test AI Reports
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500">
                Test sending reports to all enabled owners (for testing purposes)
              </p>
            </div>

            {/* Send Manually Buttons */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Send Manually</h4>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setShowSendConfirmDialog(true)
                    setSendReportType('owners')
                  }}
                  disabled={testingAIReports || sendingAIReports}
                  variant="outline"
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send to Owners
                </Button>
                <Button
                  onClick={() => {
                    setShowSendConfirmDialog(true)
                    setSendReportType('company')
                  }}
                  disabled={testingAIReports || sendingAIReports}
                  variant="outline"
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Company Report
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Manually send reports if cron job fails. "Send to Owners" sends personalized reports to each property owner. "Send Company Report" sends a company-wide report to all admins and managers.
              </p>
            </div>
          </div>

          {/* Send Confirmation Dialog */}
          <AlertDialog open={showSendConfirmDialog} onOpenChange={setShowSendConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send AI Reports</AlertDialogTitle>
                <AlertDialogDescription>
                  {sendReportType === 'owners' 
                    ? 'Are you sure you want to send personalized AI reports to all enabled property owners? This will send actual reports via email.'
                    : 'Are you sure you want to send a company-wide AI report to all admins and managers? This will send actual reports via email.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="report-period">Report Period</Label>
                  <Select value={sendReportPeriod} onValueChange={(v: any) => setSendReportPeriod(v)}>
                    <SelectTrigger id="report-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="last-week">Last Week</SelectItem>
                      <SelectItem value="last-month">Last Month</SelectItem>
                      <SelectItem value="current-year">Current Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setShowSendConfirmDialog(false)
                    try {
                      setSendingAIReports(true)
                      setAiReportSendResult(null)
                      const res = await fetch('/api/ai-reports/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ 
                          type: sendReportType,
                          period: sendReportPeriod,
                        }),
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setAiReportSendResult(data)
                        const message = sendReportType === 'owners'
                          ? `Successfully sent ${data.successCount || data.success} owner reports. ${data.failed > 0 ? `${data.failed} failed.` : ''}`
                          : `Successfully sent company report to ${data.successCount || data.success} recipients. ${data.failed > 0 ? `${data.failed} failed.` : ''}`
                        toast.success('AI Reports Sent', message)
                      } else {
                        // Handle different error formats
                        let errorMessage = 'Failed to send AI reports'
                        if (data.error) {
                          if (typeof data.error === 'string') {
                            errorMessage = data.error
                          } else if (data.error.message) {
                            errorMessage = data.error.message
                          } else if (data.error.type === 'authentication_error') {
                            errorMessage = 'AI API authentication failed. Please check your API key in Settings → AI Providers.'
                          }
                        }
                        throw new Error(errorMessage)
                      }
                    } catch (error: any) {
                      console.error('AI reports send error:', error)
                      let errorMessage = error.message || 'Failed to send AI reports'
                      
                      // Check if it's an authentication error
                      if (errorMessage.includes('x-api-key') || errorMessage.includes('authentication_error') || errorMessage.includes('401')) {
                        errorMessage = 'AI API authentication failed. Please check your API key in Settings → AI Providers.'
                      } else if (errorMessage.includes('API key not configured')) {
                        errorMessage = 'AI API key is not configured. Please add it in Settings → AI Providers.'
                      }
                      
                      toast.error('Failed to Send Reports', errorMessage)
                      setAiReportSendResult({ error: errorMessage })
                    } finally {
                      setSendingAIReports(false)
                    }
                  }}
                  disabled={sendingAIReports}
                >
                  {sendingAIReports ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reports'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {aiReportTestResult && (
            <div className={`p-4 rounded-lg border ${
              aiReportTestResult.error 
                ? 'bg-red-50 border-red-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="font-semibold mb-2">
                {aiReportTestResult.error ? 'Test Failed' : 'Test Results'}
              </div>
              {aiReportTestResult.error ? (
                <p className="text-sm text-red-700">{aiReportTestResult.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Executed:</span>
                    <span>{aiReportTestResult.executed || 0}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Succeeded:</span>
                    <span className="text-green-600">{aiReportTestResult.success || 0}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Failed:</span>
                    <span className="text-red-600">{aiReportTestResult.failed || 0}</span>
                  </div>
                  {aiReportTestResult.errors && aiReportTestResult.errors.length > 0 && (
                    <div className="mt-2">
                      <span className="font-medium">Errors:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {aiReportTestResult.errors.map((error: string, idx: number) => (
                          <li key={idx} className="text-xs text-red-700">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiReportTestResult.timestamp && (
                    <div className="text-xs text-gray-500 mt-2">
                      Tested at: {new Date(aiReportTestResult.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Send Results */}
          {aiReportSendResult && (
            <div className={`p-4 rounded-lg border ${
              aiReportSendResult.error 
                ? 'bg-red-50 border-red-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="font-semibold mb-2">
                {aiReportSendResult.error ? 'Send Failed' : 'Send Results'}
              </div>
              {aiReportSendResult.error ? (
                <p className="text-sm text-red-700">{aiReportSendResult.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Executed:</span>
                    <span>{aiReportSendResult.executed || 0}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Succeeded:</span>
                    <span className="text-green-600">{aiReportSendResult.success || 0}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Failed:</span>
                    <span className="text-red-600">{aiReportSendResult.failed || 0}</span>
                  </div>
                  {aiReportSendResult.errors && aiReportSendResult.errors.length > 0 && (
                    <div className="mt-2">
                      <span className="font-medium">Errors:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {aiReportSendResult.errors.map((error: string, idx: number) => (
                          <li key={idx} className="text-xs text-red-700">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiReportSendResult.timestamp && (
                    <div className="text-xs text-gray-500 mt-2">
                      Sent at: {new Date(aiReportSendResult.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cron Jobs Setup */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Cron Jobs Setup
              </CardTitle>
              <CardDescription>
                Automatically set up scheduled tasks (cron jobs) for AI reports, reminders, and recurring tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cron Status */}
              {cronStatus && (
                <div className={`p-3 rounded-lg border ${
                  cronStatus.status === 'installed' 
                    ? 'bg-green-50 border-green-200' 
                    : cronStatus.status === 'not_installed'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {cronStatus.status === 'installed' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-900">Cron jobs are installed</span>
                      </>
                    ) : cronStatus.status === 'not_installed' ? (
                      <>
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <span className="font-medium text-yellow-900">Cron jobs not detected</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">Unable to check cron status</span>
                      </>
                    )}
                  </div>
                  {cronStatus.cronJobs && cronStatus.cronJobs.length > 0 && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p className="font-medium">Installed jobs:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {cronStatus.cronJobs.slice(0, 3).map((job: string, idx: number) => (
                          <li key={idx} className="text-xs font-mono truncate">{job.substring(0, 80)}...</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Setup Button */}
              <Button
                onClick={setupCronJobs}
                disabled={settingUpCron}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {settingUpCron ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Set Up Cron Jobs
                  </>
                )}
              </Button>

              {/* Setup Result */}
              {cronSetupResult && (
                <div className={`p-4 rounded-lg border ${
                  cronSetupResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="font-medium mb-2">
                    {cronSetupResult.success ? '✓ Setup Complete' : '⚠ Setup Instructions'}
                  </div>
                  <p className="text-sm mb-2">{cronSetupResult.message}</p>
                  
                  {cronSetupResult.instructions && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium">Manual Setup Required:</p>
                      <div className="bg-white p-3 rounded border text-xs font-mono space-y-1">
                        <p className="font-semibold">Option 1: SSH and run:</p>
                        <p className="text-gray-700">npm run setup:cron</p>
                        <p className="font-semibold mt-2">Option 2: Edit crontab manually:</p>
                        <p className="text-gray-700">crontab -e</p>
                        {cronSetupResult.instructions.cronJobs && (
                          <div className="mt-2 space-y-1">
                            <p className="font-semibold">Add these lines:</p>
                            {cronSetupResult.instructions.cronJobs.map((job: any, idx: number) => (
                              <div key={idx} className="text-gray-700">
                                <span className="text-purple-600">{job.schedule}</span> {job.command}
                                <span className="text-gray-500 ml-2"># {job.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        See <code className="bg-gray-100 px-1 rounded">AUTO_CRON_SETUP.md</code> for detailed instructions
                      </p>
                    </div>
                  )}

                  {cronSetupResult.output && (
                    <details className="mt-2">
                      <summary className="text-sm cursor-pointer text-gray-700">View output</summary>
                      <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                        {cronSetupResult.output}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="font-semibold text-blue-900 mb-2 text-sm">About Cron Jobs</div>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Cron jobs run scheduled tasks automatically (AI reports, reminders, etc.)</li>
                  <li>They need to be set up on your server, not in the application</li>
                  <li>If automatic setup fails, you can set them up manually via SSH</li>
                  <li>Make sure <code className="bg-blue-100 px-1 rounded">CRON_SECRET</code> and <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_APP_URL</code> are set in environment variables</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="font-semibold text-blue-900 mb-2">How It Works</div>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>AI reports are automatically sent based on each owner's preferences (daily/weekly)</li>
              <li>The cron job runs hourly and checks which owners are due to receive reports</li>
              <li>Reports are sent via email to the owner's registered email address</li>
              <li>Use the test button above to manually trigger reports for testing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Cleaning Checklists Manager Component
function CleaningChecklistsManager() {
  const [checklists, setChecklists] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    propertyId: '',
    isDefault: false,
    items: [] as Array<{ id: string; text: string; required?: boolean }>,
  })
  const [newItemText, setNewItemText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchChecklists()
    fetchProperties()
  }, [])

  const fetchChecklists = async () => {
    try {
      const res = await fetch('/api/cleaning-checklists?includeGlobal=true', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setChecklists(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch checklists:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setProperties(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const handleAddItem = () => {
    if (!newItemText.trim()) return
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { id: crypto.randomUUID(), text: newItemText.trim(), required: false },
      ],
    })
    setNewItemText('')
  }

  const handleRemoveItem = (id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((item) => item.id !== id),
    })
  }

  const handleOpenDialog = (checklist?: any) => {
    if (checklist) {
      setEditingChecklist(checklist)
      setFormData({
        name: checklist.name || '',
        propertyId: checklist.propertyId || '',
        isDefault: checklist.isDefault || false,
        items: (checklist.items as any[]) || [],
      })
    } else {
      setEditingChecklist(null)
      setFormData({
        name: '',
        propertyId: '',
        isDefault: false,
        items: [],
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || formData.items.length === 0) {
      toast.error('Name and at least one item are required')
      return
    }

    setSaving(true)
    try {
      const url = editingChecklist
        ? `/api/cleaning-checklists/${editingChecklist.id}`
        : '/api/cleaning-checklists'
      const method = editingChecklist ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          propertyId: formData.propertyId || null,
          items: formData.items,
          isDefault: formData.isDefault,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save checklist')
      }

      toast.success('Checklist saved successfully')
      setDialogOpen(false)
      fetchChecklists()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save checklist')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this checklist?')) return

    try {
      const res = await fetch(`/api/cleaning-checklists/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete checklist')
      }

      toast.success('Checklist deleted')
      fetchChecklists()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete checklist')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <TableSkeletonLoader rows={5} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cleaning Checklist Templates</CardTitle>
              <CardDescription>
                Create and manage cleaning checklist templates for properties
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              New Checklist
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {checklists.length === 0 ? (
            <EmptyState
              title="No checklists found"
              description="Create your first cleaning checklist template"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklists.map((checklist) => (
                  <TableRow key={checklist.id}>
                    <TableCell className="font-medium">{checklist.name}</TableCell>
                    <TableCell>
                      {checklist.propertyId
                        ? checklist.Property?.name || 'Unknown'
                        : 'Global'}
                    </TableCell>
                    <TableCell>
                      {(checklist.items as any[])?.length || 0} items
                    </TableCell>
                    <TableCell>
                      {checklist.isDefault ? (
                        <Badge variant="default">Default</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={checklist.isActive ? 'default' : 'secondary'}>
                        {checklist.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(checklist)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(checklist.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingChecklist ? 'Edit Checklist' : 'New Checklist'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Cleaning Checklist"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyId">Property (Optional)</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) =>
                  setFormData({ ...formData, propertyId: value === 'global' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property or leave for global" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (All Properties)</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.nickname || prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                Leave as "Global" to use for all properties, or select a specific property
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="isDefault">Set as default checklist</Label>
            </div>

            <div className="space-y-2">
              <Label>Checklist Items *</Label>
              <div className="space-y-2">
                {formData.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-gray-400" />
                    <span className="flex-1">{item.text}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                    placeholder="Add checklist item..."
                  />
                  <Button onClick={handleAddItem} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
