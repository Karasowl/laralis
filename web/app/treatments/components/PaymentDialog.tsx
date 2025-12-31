'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { formatCurrency } from '@/lib/money'
import { DollarSign, CreditCard } from 'lucide-react'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  treatment: {
    id: string
    price_cents: number
    amount_paid_cents: number
    service?: { name: string }
    patient?: { first_name: string; last_name: string }
  } | null
  onSubmit: (treatmentId: string, amountCents: number) => Promise<boolean>
}

export function PaymentDialog({
  open,
  onOpenChange,
  treatment,
  onSubmit,
}: PaymentDialogProps) {
  const t = useTranslations('treatments.payment')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!treatment) return null

  const balanceCents = (treatment.price_cents || 0) - (treatment.amount_paid_cents || 0)
  const balancePesos = balanceCents / 100

  const handlePayFull = () => {
    setAmount(balancePesos.toString())
  }

  const handleSubmit = async () => {
    const amountPesos = parseFloat(amount)
    if (isNaN(amountPesos) || amountPesos <= 0) return

    const amountCents = Math.round(amountPesos * 100)
    if (amountCents > balanceCents) return

    setIsSubmitting(true)
    try {
      const success = await onSubmit(treatment.id, amountCents)
      if (success) {
        setAmount('')
        onOpenChange(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const amountPesos = parseFloat(amount) || 0
  const amountCents = Math.round(amountPesos * 100)
  const isValid = amountCents > 0 && amountCents <= balanceCents

  const patientName = treatment.patient
    ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('registerPayment')}
          </DialogTitle>
          <DialogDescription>
            {treatment.service?.name} - {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Current balance */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('remainingBalance')}
              </span>
              <span className="text-lg font-semibold text-orange-600">
                {formatCurrency(balanceCents)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total: {formatCurrency(treatment.price_cents)}</span>
              <span>Pagado: {formatCurrency(treatment.amount_paid_cents)}</span>
            </div>
          </div>

          {/* Payment amount input */}
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">{t('paymentAmount')}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="payment-amount"
                  type="number"
                  min="0"
                  max={balancePesos}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handlePayFull}
                disabled={balanceCents <= 0}
              >
                {t('payFull')}
              </Button>
            </div>
            {amountCents > balanceCents && (
              <p className="text-sm text-destructive">
                El monto excede el saldo pendiente
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? '...' : t('registerPayment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
