'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { FormModal } from '@/components/ui/form-modal'
import { Form } from '@/components/ui/form'
import { FormSection, FormGrid } from '@/components/ui/form-field'
import { formatCurrency } from '@/lib/format'
import { calcularPrecioConDescuento, calculateDiscountAmount } from '@/lib/calc/tarifa'

const discountSchema = z.object({
  type: z.enum(['none', 'percentage', 'fixed']),
  value: z.number().min(0),
  reason: z.string().optional()
}).refine((data) => {
  if (data.type === 'percentage' && data.value > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['value']
})

interface DiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceName?: string
  basePrice: number
  existingDiscount?: {
    type: 'none' | 'percentage' | 'fixed'
    value: number
    reason?: string
  }
  onApply: (discount: {
    type: 'none' | 'percentage' | 'fixed'
    value: number
    reason?: string
  }) => void
}

export function DiscountModal({
  open,
  onOpenChange,
  serviceName,
  basePrice,
  existingDiscount,
  onApply
}: DiscountModalProps) {
  const t = useTranslations('tariffs')
  const tCommon = useTranslations('common')

  const form = useForm({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      type: 'none' as const,
      value: 0,
      reason: ''
    }
  })

  // Load existing discount when modal opens
  useEffect(() => {
    if (open && existingDiscount) {
      // Convert centavos → pesos for fixed discounts (display in pesos)
      const displayValue = existingDiscount.type === 'fixed'
        ? existingDiscount.value / 100
        : existingDiscount.value

      form.setValue('type', existingDiscount.type as 'none' | 'percentage' | 'fixed')
      form.setValue('value', displayValue)
      form.setValue('reason', existingDiscount.reason || '')
    } else if (open) {
      // Reset to defaults when opening without existing discount
      form.reset()
    }
  }, [open, existingDiscount, form])

  const watchedType = form.watch('type')
  const watchedValue = form.watch('value')

  // For calculations, convert pesos → centavos if type is 'fixed'
  const calculationValue = watchedType === 'fixed'
    ? watchedValue * 100
    : watchedValue

  const discountAmount = watchedType !== 'none' && watchedValue > 0
    ? calculateDiscountAmount(basePrice, watchedType, calculationValue)
    : 0

  const finalPrice = watchedType !== 'none' && watchedValue > 0
    ? calcularPrecioConDescuento(basePrice, watchedType, calculationValue)
    : basePrice

  const handleSubmit = (data: z.infer<typeof discountSchema>) => {
    // Convert pesos → centavos for fixed discounts before saving
    const discountData = {
      type: data.type,
      value: data.type === 'fixed' ? data.value * 100 : data.value,
      reason: data.reason
    }
    onApply(discountData)
    onOpenChange(false)
    form.reset()
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) form.reset()
      }}
      title={serviceName ? `${t('discount_modal_title')}: ${serviceName}` : t('discount_modal_title')}
      onSubmit={form.handleSubmit(handleSubmit)}
      maxWidth="md"
    >
      <Form {...form}>
        <FormSection>
          <div className="space-y-4">
            {/* Discount Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('discount_type')}
              </label>
              <select
                {...form.register('type')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="none">{t('no_discount')}</option>
                <option value="percentage">{t('percentage_discount')}</option>
                <option value="fixed">{t('fixed_discount')}</option>
              </select>
            </div>

            {/* Discount Value */}
            {watchedType !== 'none' && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {watchedType === 'percentage'
                    ? t('discount_percentage_label')
                    : `${t('discount_fixed_label')} (MXN)`}
                </label>
                <input
                  type="number"
                  {...form.register('value', { valueAsNumber: true })}
                  placeholder={watchedType === 'percentage' ? '10' : '500'}
                  min={0}
                  max={watchedType === 'percentage' ? 100 : undefined}
                  step={watchedType === 'percentage' ? 1 : 10}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                {form.formState.errors.value && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.value.message}
                  </p>
                )}
              </div>
            )}

            {/* Discount Reason */}
            {watchedType !== 'none' && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('discount_reason')}
                </label>
                <input
                  type="text"
                  {...form.register('reason')}
                  placeholder={t('discount_reason_placeholder')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}

            {/* Preview */}
            {watchedType !== 'none' && watchedValue > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <div className="text-sm font-medium mb-2">{t('discount_preview')}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('original_price')}:</span>
                    <span className="font-medium">{formatCurrency(basePrice)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>{t('discount')}:</span>
                    <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold text-emerald-600">
                    <span>{t('final_price')}:</span>
                    <span>{formatCurrency(finalPrice)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {t('you_save')} {formatCurrency(discountAmount)} (
                    {((discountAmount / basePrice) * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>
      </Form>
    </FormModal>
  )
}
