'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ConvertLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string | null
  defaultName?: string | null
  defaultPhone?: string | null
  defaultEmail?: string | null
  onConverted?: (patientId: string) => void
}

export function ConvertLeadDialog({
  open,
  onOpenChange,
  conversationId,
  defaultName,
  defaultPhone,
  defaultEmail,
  onConverted,
}: ConvertLeadDialogProps) {
  const t = useTranslations('inbox.convert')
  const tCommon = useTranslations('common')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    const parts = (defaultName || '').trim().split(/\s+/)
    setFirstName(parts[0] || '')
    setLastName(parts.slice(1).join(' '))
    setPhone(defaultPhone?.replace(/^whatsapp:/i, '') || '')
    setEmail(defaultEmail || '')
    setNotes('')
  }, [open, defaultName, defaultPhone, defaultEmail])

  const handleSubmit = async () => {
    if (!conversationId || !firstName.trim()) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/inbox/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || t('errors.generic'))
      }

      toast.success(payload?.data?.alreadyLinked ? t('alreadyLinked') : t('success'))
      onOpenChange(false)
      if (payload?.data?.patient?.id) {
        onConverted?.(payload.data.patient.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.generic')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="convert-first-name">{t('firstName')}</Label>
              <Input
                id="convert-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="convert-last-name">{t('lastName')}</Label>
              <Input
                id="convert-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="convert-phone">{t('phone')}</Label>
            <Input
              id="convert-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+5215555555555"
            />
          </div>
          <div>
            <Label htmlFor="convert-email">{t('email')}</Label>
            <Input
              id="convert-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="convert-notes">{t('notes')}</Label>
            <Textarea
              id="convert-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('notesPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !firstName.trim()}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            {submitting ? tCommon('saving') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
