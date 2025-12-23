'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from '@/lib/toast'

interface CheckInButtonProps {
  bookingId: string
  checkedInAt?: string | null
  checkedInBy?: {
    name?: string | null
    email?: string | null
  } | null
  checkInNotes?: string | null
  onCheckIn?: () => void
  disabled?: boolean
}

export function CheckInButton({
  bookingId,
  checkedInAt,
  checkedInBy,
  checkInNotes,
  onCheckIn,
  disabled = false,
}: CheckInButtonProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(checkInNotes || '')
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to check in guest')
      }

      toast.success('Guest checked in successfully')
      setOpen(false)
      if (onCheckIn) {
        onCheckIn()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest')
    } finally {
      setLoading(false)
    }
  }

  if (checkedInAt) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">Guest Checked In</p>
          <p className="text-xs text-green-700">
            {format(new Date(checkedInAt), 'MMM dd, yyyy HH:mm')}
            {checkedInBy?.name && ` by ${checkedInBy.name}`}
          </p>
          {checkInNotes && (
            <p className="text-xs text-green-600 mt-1">{checkInNotes}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Check In Guest
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In Guest</DialogTitle>
            <DialogDescription>
              Mark this guest as checked in. You can add optional notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the check-in..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckIn} disabled={loading}>
              {loading ? 'Checking in...' : 'Check In Guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

