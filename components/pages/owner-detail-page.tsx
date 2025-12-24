'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { Currency, TransactionType } from '@prisma/client'
import { format } from 'date-fns'
import { ArrowLeft, Edit, Building2, DollarSign, Receipt, FileText, CreditCard, Phone, Plus, Mail, Clock, Save, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'
import { TableSkeletonLoader } from '@/components/ui/skeleton-loader'
import { toast } from '@/lib/toast'
import { ContactForm } from '@/components/forms/contact-form'
import { DocumentManager } from '@/components/ui/document-manager'
// ContactType enum - using string literals
type ContactType = 'MAINTENANCE' | 'PLUMBING' | 'ELECTRICAL' | 'CLEANING' | 'HVAC' | 'GENERAL' | 'OTHER'

interface OwnerDetailPageProps {
  ownerId: string
}

export function OwnerDetailPage({ ownerId }: OwnerDetailPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [owner, setOwner] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [showPayoutDialog, setShowPayoutDialog] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [showBalancePaymentDialog, setShowBalancePaymentDialog] = useState(false)
  const [balancePaymentLoading, setBalancePaymentLoading] = useState(false)
  const [commissionTransactions, setCommissionTransactions] = useState<any[]>([])
  const [balancePayments, setBalancePayments] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<any>(null)
  const [aiReportPrefs, setAiReportPrefs] = useState({
    enabled: false,
    frequency: 'none' as 'daily' | 'weekly' | 'none',
    preferredTime: '08:00',
    lastSent: null as string | null,
    nextSend: null as string | null,
  })
  const [savingAiReport, setSavingAiReport] = useState(false)
  const [paymentForm, setPaymentForm] = useState<{
    amount: string
    currency: Currency
    reference: string
    notes: string
  }>({
    amount: '',
    currency: Currency.GHS,
    reference: '',
    notes: '',
  })
  const [payoutForm, setPayoutForm] = useState<{
    amount: string
    currency: Currency
    method: string
    reference: string
  }>({
    amount: '',
    currency: Currency.GHS,
    method: '',
    reference: '',
  })
  const [balancePaymentForm, setBalancePaymentForm] = useState<{
    amount: string
    currency: Currency
    reference: string
    notes: string
  }>({
    amount: '',
    currency: Currency.GHS,
    reference: '',
    notes: '',
  })

  useEffect(() => {
    fetchOwner()
    fetchCommissionTransactions()
    fetchBalancePayments()
    fetchPayouts()
    fetchContacts()
    fetchAIReportPreferences()
  }, [ownerId])

  const fetchOwner = async () => {
    try {
      const res = await fetch(`/api/owners/${ownerId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch owner')
      }
      const data = await res.json()
      setOwner(data)
    } catch (error) {
      console.error('Failed to fetch owner:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCommissionTransactions = async () => {
    try {
      const res = await fetch(`/api/owners/${ownerId}/transactions`)
      if (!res.ok) return
      const data = await res.json()
      // Filter for commission payments - handle both string and enum comparison
      const commissionPayments = Array.isArray(data)
        ? data.filter((tx: any) => 
            tx.type === TransactionType.COMMISSION_PAYMENT || 
            tx.type === 'COMMISSION_PAYMENT'
          )
        : []
      setCommissionTransactions(commissionPayments)
    } catch (error) {
      console.error('Failed to fetch commission transactions:', error)
    }
  }

  const fetchBalancePayments = async () => {
    try {
      const res = await fetch(`/api/owners/${ownerId}/transactions`)
      if (!res.ok) return
      const data = await res.json()
      // Filter for manual adjustments (balance payments)
      const payments = Array.isArray(data)
        ? data.filter((tx: any) => 
            tx.type === TransactionType.MANUAL_ADJUSTMENT || 
            tx.type === 'MANUAL_ADJUSTMENT'
          )
        : []
      setBalancePayments(payments)
    } catch (error) {
      console.error('Failed to fetch balance payments:', error)
    }
  }

  const fetchPayouts = async () => {
    try {
      const res = await fetch(`/api/payouts?ownerId=${ownerId}`)
      if (!res.ok) return
      const data = await res.json()
      setPayouts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch payouts:', error)
    }
  }

  const fetchContacts = async () => {
    try {
      const res = await fetch(`/api/contacts?ownerId=${ownerId}`)
      if (!res.ok) return
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }

  const fetchAIReportPreferences = async () => {
    try {
      const res = await fetch(`/api/admin/owners/${ownerId}/ai-reports`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setAiReportPrefs({
          enabled: data.enabled || false,
          frequency: data.frequency || 'none',
          preferredTime: data.preferredTime || '08:00',
          lastSent: data.lastSent,
          nextSend: data.nextSend,
        })
      }
    } catch (error) {
      console.error('Failed to fetch AI report preferences:', error)
    }
  }

  const handleSaveAIReportPreferences = async () => {
    try {
      setSavingAiReport(true)
      const res = await fetch(`/api/admin/owners/${ownerId}/ai-reports`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: aiReportPrefs.enabled,
          frequency: aiReportPrefs.frequency,
          preferredTime: aiReportPrefs.preferredTime,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save AI report preferences')
      }

      const data = await res.json()
      setAiReportPrefs({
        enabled: data.enabled,
        frequency: data.frequency,
        preferredTime: data.preferredTime,
        lastSent: data.lastSent,
        nextSend: data.nextSend,
      })
      toast.success('AI Report Preferences Saved', 'Owner AI report settings have been updated')
    } catch (error: any) {
      toast.error('Failed to save', error.message)
    } finally {
      setSavingAiReport(false)
    }
  }

  const handleContactSuccess = () => {
    setShowContactDialog(false)
    setEditingContact(null)
    fetchContacts()
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPaymentLoading(true)

    try {
      // Round amount to 2 decimal places
      const roundedAmount = Math.round(parseFloat(paymentForm.amount) * 100) / 100
      
      const res = await fetch(`/api/owners/${ownerId}/commissions/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentForm,
          amount: roundedAmount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment')
      }

      toast.success('Payment recorded', 'Commission payment has been recorded successfully')
      setShowPaymentDialog(false)
      setPaymentForm({ amount: '', currency: Currency.GHS, reference: '', notes: '' })
      fetchOwner()
      fetchCommissionTransactions()
    } catch (error: any) {
      toast.error('Payment failed', error.message)
    } finally {
      setPaymentLoading(false)
    }
  }

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayoutLoading(true)

    try {
      // Round amount to 2 decimal places
      const roundedAmount = Math.round(parseFloat(payoutForm.amount) * 100) / 100
      
      const res = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          amount: roundedAmount,
          currency: payoutForm.currency,
          method: payoutForm.method || null,
          reference: payoutForm.reference || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payout')
      }

      toast.success('Payout recorded', 'Payout has been recorded successfully and balance updated')
      setShowPayoutDialog(false)
      setPayoutForm({ amount: '', currency: Currency.GHS, method: '', reference: '' })
      fetchOwner()
      fetchPayouts()
    } catch (error: any) {
      toast.error('Payout failed', error.message)
    } finally {
      setPayoutLoading(false)
    }
  }

  const handleBalancePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBalancePaymentLoading(true)

    try {
      // Round amount to 2 decimal places
      const roundedAmount = Math.round(parseFloat(balancePaymentForm.amount) * 100) / 100
      
      const res = await fetch(`/api/owners/${ownerId}/balance/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: roundedAmount,
          currency: balancePaymentForm.currency,
          reference: balancePaymentForm.reference || null,
          notes: balancePaymentForm.notes || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment')
      }

      toast.success('Payment received', 'Balance payment has been recorded successfully')
      setShowBalancePaymentDialog(false)
      setBalancePaymentForm({ amount: '', currency: Currency.GHS, reference: '', notes: '' })
      fetchOwner()
      fetchBalancePayments()
    } catch (error: any) {
      toast.error('Payment failed', error.message)
    } finally {
      setBalancePaymentLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Owner not found</p>
          <Button onClick={() => router.push('/admin/owners')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Owners
          </Button>
        </div>
      </div>
    )
  }

  const backPath = pathname?.startsWith('/admin') ? '/admin/owners' : '/owner'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push(backPath)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{owner.name}</h1>
        </div>
        <div className="flex gap-2">
          {(owner.OwnerWallet?.currentBalance || 0) < 0 && (
            <Button
              onClick={() => setShowBalancePaymentDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Receive Payment
            </Button>
          )}
          {(owner.OwnerWallet?.currentBalance || 0) > 0 && (
            <Button
              onClick={() => setShowPayoutDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payout
            </Button>
          )}
          {(owner.OwnerWallet?.commissionsPayable || 0) > 0 && (
            <Button
              onClick={() => setShowPaymentDialog(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Record Commission Payment
            </Button>
          )}
          <Link href={`/admin/owners/${owner.id}/edit`}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Owner Info */}
      <Card>
        <CardHeader>
          <CardTitle>Owner Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Email</div>
              <div className="font-medium">{owner.email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Phone</div>
              <div className="font-medium">{owner.phoneNumber || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">WhatsApp</div>
              <div className="font-medium">{owner.whatsappNumber || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <Badge
                variant={owner.status === 'active' ? 'default' : 'secondary'}
              >
                {owner.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-600">Preferred Currency</div>
              <div className="font-medium">{owner.preferredCurrency}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Current Balance</div>
              <div className="font-medium">
                {formatCurrency(
                  owner.OwnerWallet?.currentBalance || 0,
                  owner.preferredCurrency
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Commissions Payable</div>
              <div className={`font-medium ${(owner.OwnerWallet?.commissionsPayable || 0) > 0 ? 'text-orange-600' : ''}`}>
                {formatCurrency(
                  owner.OwnerWallet?.commissionsPayable || 0,
                  owner.preferredCurrency
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Properties</div>
              <div className="font-medium">{owner.Property?.length || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div className="font-medium">
                {format(new Date(owner.createdAt), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>
          {owner.notes && (
            <div className="mt-4">
              <div className="text-sm text-gray-600">Notes</div>
              <div className="mt-1 text-sm">{owner.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Properties ({owner.Property?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {owner.Property && owner.Property.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Commission Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owner.Property.map((property: any) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">
                      {property.nickname || property.name}
                    </TableCell>
                    <TableCell>
                      {property.city || property.address || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          property.status === 'active' ? 'default' : 'secondary'
                        }
                      >
                        {property.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(property.defaultCommissionRate * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/properties/${property.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No properties found
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Recent Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {owner.Booking && owner.Booking.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owner.Booking.map((booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.Property?.name || '-'}
                    </TableCell>
                    <TableCell>{booking.guestName || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{booking.nights}</TableCell>
                    <TableCell>
                      {formatCurrency(
                        booking.totalPayout,
                        booking.currency
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No bookings found
            </p>
          )}
        </CardContent>
      </Card>

      {/* Commission Payments */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-orange-600">
                <CreditCard className="w-5 h-5" />
                Commission Payments
              </span>
            {(owner.OwnerWallet?.commissionsPayable || 0) > 0 && (
              <Button
                onClick={() => setShowPaymentDialog(true)}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                Record Payment
              </Button>
            )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commissionTransactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        {format(new Date(tx.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Math.abs(tx.amount), tx.currency)}
                      </TableCell>
                      <TableCell>{tx.referenceId || '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {tx.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No commission payments recorded yet
              </p>
            )}
          </CardContent>
        </Card>

      {/* Payouts */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-green-600">
              <DollarSign className="w-5 h-5" />
              Payouts
            </span>
            {(owner.OwnerWallet?.currentBalance || 0) > 0 && (
              <Button
                onClick={() => setShowPayoutDialog(true)}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Record Payout
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout: any) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      {format(new Date(payout.processedAt || payout.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payout.amount, payout.currency)}
                    </TableCell>
                    <TableCell>{payout.method || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {payout.reference || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No payouts recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Balance Payments Received */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-blue-600">
              <DollarSign className="w-5 h-5" />
              Balance Payments Received
            </span>
            {(owner.OwnerWallet?.currentBalance || 0) < 0 && (
              <Button
                onClick={() => setShowBalancePaymentDialog(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Receive Payment
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balancePayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balancePayments.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {format(new Date(tx.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      +{formatCurrency(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {tx.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No balance payments received yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Report Preferences */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <Mail className="w-5 h-5" />
            AI Report Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ai-report-enabled" className="text-base font-medium">
                Enable AI Reports
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Send automated property briefs via email
              </p>
            </div>
            <Switch
              id="ai-report-enabled"
              checked={aiReportPrefs.enabled}
              onCheckedChange={(checked) =>
                setAiReportPrefs({ ...aiReportPrefs, enabled: checked, frequency: checked ? 'weekly' : 'none' })
              }
            />
          </div>

          {aiReportPrefs.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ai-report-frequency">Frequency</Label>
                <Select
                  value={aiReportPrefs.frequency}
                  onValueChange={(value: 'daily' | 'weekly' | 'none') =>
                    setAiReportPrefs({ ...aiReportPrefs, frequency: value })
                  }
                >
                  <SelectTrigger id="ai-report-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {aiReportPrefs.frequency === 'daily'
                    ? 'Reports will be sent every day'
                    : aiReportPrefs.frequency === 'weekly'
                    ? 'Reports will be sent once per week'
                    : 'Reports are disabled'}
                </p>
              </div>

              {aiReportPrefs.frequency !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="ai-report-time">Preferred Time</Label>
                  <Input
                    id="ai-report-time"
                    type="time"
                    value={aiReportPrefs.preferredTime}
                    onChange={(e) => setAiReportPrefs({ ...aiReportPrefs, preferredTime: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Time of day to send the report (24-hour format)
                  </p>
                </div>
              )}

              {(aiReportPrefs.lastSent || aiReportPrefs.nextSend) && (
                <div className="pt-4 border-t space-y-2">
                  {aiReportPrefs.lastSent && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Last sent:</span>
                      <span className="font-medium">
                        {format(new Date(aiReportPrefs.lastSent), 'MMM dd, yyyy h:mm a')}
                      </span>
                    </div>
                  )}
                  {aiReportPrefs.nextSend && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Next send:</span>
                      <span className="font-medium">
                        {format(new Date(aiReportPrefs.nextSend), 'MMM dd, yyyy h:mm a')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t">
                <Button
                  onClick={handleSaveAIReportPreferences}
                  disabled={savingAiReport}
                  className="w-full"
                >
                  {savingAiReport ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-purple-600">
              <Phone className="w-5 h-5" />
              Maintenance Contacts ({contacts.length})
            </span>
            <Button
              size="sm"
              onClick={() => {
                setEditingContact(null)
                setShowContactDialog(true)
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {contact.type}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span>{contact.phoneNumber}</span>
                      {contact.email && <span className="ml-3">{contact.email}</span>}
                    </div>
                    {contact.company && (
                      <div className="text-xs text-gray-500 mt-1">{contact.company}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingContact(contact)
                      setShowContactDialog(true)
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Phone className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No contacts yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setEditingContact(null)
                  setShowContactDialog(true)
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Contact
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <DocumentManager ownerId={ownerId} title="Owner Documents" />

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add Maintenance Contact'}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Update the contact information below.'
                : 'Add a maintenance contact for this owner.'}
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            contactId={editingContact?.id}
            initialData={editingContact}
            ownerId={ownerId}
            onSuccess={handleContactSuccess}
            onCancel={() => {
              setShowContactDialog(false)
              setEditingContact(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payout to Owner</DialogTitle>
            <DialogDescription>
              Record a payout to {owner?.name}. Current balance:{' '}
              <span className="font-semibold text-green-600">
                {formatCurrency(
                  owner?.OwnerWallet?.currentBalance || 0,
                  owner?.preferredCurrency || Currency.GHS
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayoutSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="payout-amount">Amount *</Label>
                <Input
                  id="payout-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.round((owner?.OwnerWallet?.currentBalance || 0) * 100) / 100}
                  value={payoutForm.amount}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setPayoutForm({ ...payoutForm, amount: '' })
                    } else {
                      const numValue = parseFloat(value)
                      if (!isNaN(numValue)) {
                        const rounded = Math.round(numValue * 100) / 100
                        setPayoutForm({ ...payoutForm, amount: rounded.toString() })
                      } else {
                        setPayoutForm({ ...payoutForm, amount: value })
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value)) {
                      const rounded = Math.round(value * 100) / 100
                      setPayoutForm({ ...payoutForm, amount: rounded.toFixed(2) })
                    }
                  }}
                  required
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  Maximum: {formatCurrency(
                    Math.round((owner?.OwnerWallet?.currentBalance || 0) * 100) / 100,
                    owner?.preferredCurrency || Currency.GHS
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-currency">Currency *</Label>
                <Select
                  value={payoutForm.currency}
                  onValueChange={(value) =>
                    setPayoutForm({ ...payoutForm, currency: value as Currency })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.GHS}>GHS</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-method">Payment Method</Label>
                <Input
                  id="payout-method"
                  value={payoutForm.method}
                  onChange={(e) =>
                    setPayoutForm({ ...payoutForm, method: e.target.value })
                  }
                  placeholder="e.g., Bank Transfer, Mobile Money, Cash"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout-reference">Reference</Label>
                <Input
                  id="payout-reference"
                  value={payoutForm.reference}
                  onChange={(e) =>
                    setPayoutForm({ ...payoutForm, reference: e.target.value })
                  }
                  placeholder="Transaction reference or receipt number"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPayoutDialog(false)}
                disabled={payoutLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={payoutLoading}>
                {payoutLoading ? 'Recording...' : 'Record Payout'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Commission Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Commission Payment</DialogTitle>
            <DialogDescription>
              Record a commission payment from {owner?.name}. Outstanding balance:{' '}
              <span className="font-semibold text-orange-600">
                {formatCurrency(
                  owner?.OwnerWallet?.commissionsPayable || 0,
                  owner?.preferredCurrency || Currency.GHS
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.round((owner?.OwnerWallet?.commissionsPayable || 0) * 100) / 100}
                  value={paymentForm.amount}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setPaymentForm({ ...paymentForm, amount: '' })
                    } else {
                      const numValue = parseFloat(value)
                      if (!isNaN(numValue)) {
                        const rounded = Math.round(numValue * 100) / 100
                        setPaymentForm({ ...paymentForm, amount: rounded.toString() })
                      } else {
                        setPaymentForm({ ...paymentForm, amount: value })
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value)) {
                      const rounded = Math.round(value * 100) / 100
                      setPaymentForm({ ...paymentForm, amount: rounded.toFixed(2) })
                    }
                  }}
                  required
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  Maximum: {formatCurrency(
                    Math.round((owner?.OwnerWallet?.commissionsPayable || 0) * 100) / 100,
                    owner?.preferredCurrency || Currency.GHS
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={paymentForm.currency}
                  onValueChange={(value) =>
                    setPaymentForm({ ...paymentForm, currency: value as Currency })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.GHS}>GHS</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, reference: e.target.value })
                  }
                  placeholder="Payment reference or transaction ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                  placeholder="Additional notes about this payment"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPaymentDialog(false)}
                disabled={paymentLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={paymentLoading}>
                {paymentLoading ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Balance Payment Dialog */}
      <Dialog open={showBalancePaymentDialog} onOpenChange={setShowBalancePaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Balance Payment</DialogTitle>
            <DialogDescription>
              Record a payment received from {owner?.name} to reduce their outstanding balance.{' '}
              <span className="font-semibold text-red-600">
                Outstanding: {formatCurrency(
                  Math.abs(owner?.OwnerWallet?.currentBalance || 0),
                  owner?.preferredCurrency || Currency.GHS
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBalancePaymentSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="balance-amount">Amount *</Label>
                <Input
                  id="balance-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Math.round(Math.abs(owner?.OwnerWallet?.currentBalance || 0) * 100) / 100}
                  value={balancePaymentForm.amount}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      setBalancePaymentForm({ ...balancePaymentForm, amount: '' })
                    } else {
                      const numValue = parseFloat(value)
                      if (!isNaN(numValue)) {
                        const rounded = Math.round(numValue * 100) / 100
                        setBalancePaymentForm({ ...balancePaymentForm, amount: rounded.toString() })
                      } else {
                        setBalancePaymentForm({ ...balancePaymentForm, amount: value })
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value)) {
                      const rounded = Math.round(value * 100) / 100
                      setBalancePaymentForm({ ...balancePaymentForm, amount: rounded.toFixed(2) })
                    }
                  }}
                  required
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  Maximum: {formatCurrency(
                    Math.round(Math.abs(owner?.OwnerWallet?.currentBalance || 0) * 100) / 100,
                    owner?.preferredCurrency || Currency.GHS
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance-currency">Currency *</Label>
                <Select
                  value={balancePaymentForm.currency}
                  onValueChange={(value) =>
                    setBalancePaymentForm({ ...balancePaymentForm, currency: value as Currency })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.GHS}>GHS</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance-reference">Reference</Label>
                <Input
                  id="balance-reference"
                  value={balancePaymentForm.reference}
                  onChange={(e) =>
                    setBalancePaymentForm({ ...balancePaymentForm, reference: e.target.value })
                  }
                  placeholder="Payment reference or transaction ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance-notes">Notes</Label>
                <Textarea
                  id="balance-notes"
                  value={balancePaymentForm.notes}
                  onChange={(e) =>
                    setBalancePaymentForm({ ...balancePaymentForm, notes: e.target.value })
                  }
                  placeholder="Additional notes about this payment"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBalancePaymentDialog(false)}
                disabled={balancePaymentLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={balancePaymentLoading}>
                {balancePaymentLoading ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

