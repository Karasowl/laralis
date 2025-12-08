'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface RefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onConfirm: (reason: string) => void | Promise<void>
  isSubmitting?: boolean
}

export function RefundDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isSubmitting = false
}: RefundDialogProps) {
  const t = useTranslations('treatments.refund')
  const tCommon = useTranslations('common')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError(t('reasonRequired'))
      return
    }
    setError('')
    await onConfirm(reason.trim())
    setReason('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('')
      setError('')
    }
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title || t('title')}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {description || t('confirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="refund-reason" className="text-sm font-medium">
            {t('reason')} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="refund-reason"
            placeholder={t('reasonPlaceholder')}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError('')
            }}
            className="min-h-[100px] resize-none"
            disabled={isSubmitting}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isSubmitting}>
            {tCommon('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isSubmitting || !reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon('saving')}
              </>
            ) : (
              t('button')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
