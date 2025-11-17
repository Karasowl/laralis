'use client'

import { useState } from 'react'
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
      discount_type: (service?.discount_type || 'none') as 'none' | 'percentage' | 'fixed',
      discount_value: service?.discount_value || 0,
      discount_reason: service?.discount_reason || ''
    }
  })

  const discountType = form.watch('discount_type')
  const discountValue = form.watch('discount_value')

  // Calculate preview with rounding
  const preview = service ? (() => {
    const priceWithMargin = service.price_cents || 0

    if (discountType === 'none') {
      return { finalPrice: priceWithMargin, savings: 0 }
    }

    let finalPrice = priceWithMargin

    if (discountType === 'percentage') {
      finalPrice = Math.round(priceWithMargin * (1 - (discountValue || 0) / 100))
    } else if (discountType === 'fixed') {
      finalPrice = Math.max(0, priceWithMargin - ((discountValue || 0) * 100))
    }

    // Apply clinic price rounding configuration
    finalPrice = applyPriceRounding(finalPrice, priceRounding, 'nearest')

    return {
      finalPrice,
      savings: priceWithMargin - finalPrice
    }
  })() : { finalPrice: 0, savings: 0 }

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

  const priceWithMargin = service.price_cents || 0

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('apply_discount')}
      description={`${service.name}`}
      onSubmit={form.handleSubmit(handleSubmit)}
      submitLabel={t('apply_discount')}
      cancelLabel={tCommon('actions.cancel')}
      isSubmitting={isSubmitting}
      size="md"
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
                  <p className="text-xl font-semibold">{formatCurrency(priceWithMargin)}</p>
                </div>
                <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">{t('final_price_with_discount')}</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(preview.finalPrice)}</p>
                </div>
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">{t('discount_savings').replace('{amount}', '')}</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(preview.savings)}</p>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <p>{t('bulk_discount_info')}</p>
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
