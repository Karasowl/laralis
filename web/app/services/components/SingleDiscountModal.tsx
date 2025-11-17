'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormModal } from '@/components/ui/form-modal'
import { FormSection, FormGrid } from '@/components/ui/form-field'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, applyPriceRounding } from '@/lib/money'
import { AlertTriangle, Info } from 'lucide-react'

const singleDiscountSchema = z.object({
  discount_type: z.enum(['none', 'percentage', 'fixed']),
  discount_value: z.number().min(0),
  discount_reason: z.string().optional()
}).refine((data) => {
  if (data.discount_type === 'percentage' && data.discount_value > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['discount_value']
})

interface SingleDiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: any | null
  priceRounding?: number
  onApply: (discount: {
    type: 'none' | 'percentage' | 'fixed'
    value: number
    reason?: string
  }) => Promise<void>
}

export function SingleDiscountModal({
  open,
  onOpenChange,
  service,
  priceRounding = 10,
  onApply
}: SingleDiscountModalProps) {
  const t = useTranslations('services')
  const tCommon = useTranslations('common')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    resolver: zodResolver(singleDiscountSchema),
    defaultValues: {
      discount_type: 'none' as 'none' | 'percentage' | 'fixed',
      discount_value: 0,
      discount_reason: ''
    }
  })

  // Reset form when service changes
  useEffect(() => {
    if (service && open) {
      console.log('🔍 Service data in modal:', {
        id: service.id,
        name: service.name,
        discount_type: service.discount_type,
        discount_value: service.discount_value,
        discount_reason: service.discount_reason
      })
      form.reset({
        discount_type: (service.discount_type || 'none') as 'none' | 'percentage' | 'fixed',
        discount_value: service.discount_value || 0,
        discount_reason: service.discount_reason || ''
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id, open])

  const discountType = form.watch('discount_type')
  const discountValue = form.watch('discount_value')

  // Calculate preview with rounding
  const preview = service ? (() => {
    // Determine the base price (price before any discount)
    // According to the new pricing architecture:
    // - service.price_cents is the single source of truth (final price with discount already applied)
    // - If service has no discount, price_cents IS the base price
    // - If service has a discount, we need to calculate base price from costs + margin

    const currentHasDiscount = service.discount_type && service.discount_type !== 'none'
    const currentFinalPrice = service.price_cents || 0

    let basePrice: number

    if (!currentHasDiscount) {
      // Service has no discount, so price_cents IS the base price
      basePrice = currentFinalPrice
    } else {
      // Service has a discount, calculate base price from costs + margin
      const totalCostCents = ((service.fixed_cost_per_minute_cents || 0) * (service.est_minutes || 0)) + (service.variable_cost_cents || 0)
      basePrice = Math.round(totalCostCents * (1 + (service.margin_pct || 0) / 100))
    }

    // If no new discount, return base price (or current price if editing existing discount)
    if (discountType === 'none') {
      return {
        basePrice,
        finalPrice: basePrice,
        savings: 0
      }
    }

    // Calculate new final price with the new discount
    let newFinalPrice = basePrice

    if (discountType === 'percentage') {
      newFinalPrice = Math.round(basePrice * (1 - (discountValue || 0) / 100))
    } else if (discountType === 'fixed') {
      newFinalPrice = Math.max(0, basePrice - ((discountValue || 0) * 100))
    }

    // Apply clinic price rounding configuration
    newFinalPrice = applyPriceRounding(newFinalPrice, priceRounding, 'nearest')

    return {
      basePrice,
      finalPrice: newFinalPrice,
      savings: basePrice - newFinalPrice
    }
  })() : { basePrice: 0, finalPrice: 0, savings: 0 }

  const handleSubmit = async (data: z.infer<typeof singleDiscountSchema>) => {
    setIsSubmitting(true)
    try {
      await onApply({
        type: data.discount_type,
        value: data.discount_value,
        reason: data.discount_reason
      })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error applying discount:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!service) return null

  // Pre-compute translations to avoid timing issues
  const modalTitle = t('apply_discount')
  const submitButtonLabel = t('apply_discount')
  const cancelButtonLabel = tCommon('cancel')

  console.log('🔍 Translations check:', {
    modalTitle,
    submitButtonLabel,
    cancelButtonLabel
  })

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={`${service.name}`}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={submitButtonLabel}
      cancelLabel={cancelButtonLabel}
      isSubmitting={isSubmitting}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <FormSection title={t('discount_configuration')}>
          <FormGrid columns={2}>
            {/* Discount Type */}
            <div>
              <label className="text-sm font-medium block mb-2">
                {t('fields.discount_type')}
              </label>
              <select
                {...form.register('discount_type')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="none">{t('discount_types.none')}</option>
                <option value="percentage">{t('discount_types.percentage')}</option>
                <option value="fixed">{t('discount_types.fixed')}</option>
              </select>
              {form.formState.errors.discount_type?.message && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.discount_type.message}</p>
              )}
            </div>

            {/* Discount Value (conditional) */}
            {discountType && discountType !== 'none' && (
              <div>
                <label className="text-sm font-medium block mb-2">
                  {discountType === 'percentage' ? t('fields.discount_percentage') : t('fields.discount_amount')}
                </label>
                <div className="relative">
                  {discountType === 'fixed' && (
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                  )}
                  <input
                    type="number"
                    {...form.register('discount_value', { valueAsNumber: true })}
                    placeholder={discountType === 'percentage' ? '10' : '50'}
                    min={0}
                    max={discountType === 'percentage' ? 100 : undefined}
                    step={discountType === 'percentage' ? 1 : 10}
                    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      discountType === 'fixed' ? 'pl-8' : 'pr-8'
                    }`}
                  />
                  {discountType === 'percentage' && (
                    <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                  )}
                </div>
                {form.formState.errors.discount_value?.message && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.discount_value.message}</p>
                )}
              </div>
            )}
          </FormGrid>

          {/* Discount Reason (full width, conditional) */}
          {discountType && discountType !== 'none' && (
            <div className="mt-4">
              <label className="text-sm font-medium block mb-2">
                {t('fields.discount_reason')}
              </label>
              <textarea
                {...form.register('discount_reason')}
                placeholder={t('discount_reason_placeholder')}
                rows={2}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('discount_reason_helper')}</p>
            </div>
          )}
        </FormSection>

        {/* Preview Section */}
        {discountType && discountType !== 'none' && (
          <FormSection title={t('price_before_discount')}>
            <div className="space-y-4">
              {/* Price Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('price_before_discount')}</p>
                  <p className="text-xl font-semibold">{formatCurrency(preview.basePrice)}</p>
                </div>
                <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">{t('final_price_with_discount')}</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(preview.finalPrice)}</p>
                </div>
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">{t('savings_label')}</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(preview.savings)}</p>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <p>{t('single_discount_info')}</p>
                    {priceRounding && priceRounding > 1 && (
                      <p className="font-medium">
                        {t('price_rounding_notice', { amount: priceRounding })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </FormSection>
        )}
      </div>
    </FormModal>
  )
}
