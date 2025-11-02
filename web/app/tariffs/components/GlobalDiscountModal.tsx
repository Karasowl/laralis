'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { FormModal } from '@/components/ui/form-modal'
import { Form } from '@/components/ui/form'
import { FormSection } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'

const globalDiscountSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().min(0)
}).refine((data) => {
  if (data.type === 'percentage' && data.value > 100) {
    return false
  }
  return true
}, {
  message: 'Percentage discount cannot exceed 100%',
  path: ['value']
})

interface GlobalDiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clinicId?: string
  servicesCount: number
}

export function GlobalDiscountModal({
  open,
  onOpenChange,
  clinicId,
  servicesCount
}: GlobalDiscountModalProps) {
  const t = useTranslations('tariffs')
  const tCommon = useTranslations('common')

  const form = useForm({
    resolver: zodResolver(globalDiscountSchema),
    defaultValues: {
      enabled: false,
      type: 'percentage' as const,
      value: 0
    }
  })

  const watchedEnabled = form.watch('enabled')
  const watchedType = form.watch('type')
  const watchedValue = form.watch('value')

  // Load existing configuration
  useEffect(() => {
    if (open && clinicId) {
      fetch(`/api/clinics/discount?clinicId=${clinicId}`)
        .then(res => res.json())
        .then(response => {
          if (response.data) {
            form.reset(response.data)
          }
        })
        .catch(err => {
          console.error('Failed to load global discount config', err)
        })
    }
  }, [open, clinicId, form])

  const handleSubmit = async (data: z.infer<typeof globalDiscountSchema>) => {
    if (!clinicId) {
      toast.error(t('no_clinic_selected'))
      return
    }

    try {
      const response = await fetch('/api/clinics/discount', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.message || 'Failed to save global discount'
        throw new Error(message)
      }

      toast.success(t('discount_applied'))
      onOpenChange(false)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving global discount'
      toast.error(errorMsg)
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) form.reset({ enabled: false, type: 'percentage', value: 0 })
      }}
      title={t('global_discount_modal_title')}
      onSubmit={form.handleSubmit(handleSubmit)}
      maxWidth="md"
    >
      <Form {...form}>
        <FormSection>
          <div className="space-y-4">
            {/* Enable/Disable Switch */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">
                  {t('enable_discount')}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t('global_discount_modal_description')}
                </p>
              </div>
              <Switch
                checked={watchedEnabled}
                onCheckedChange={(checked) => form.setValue('enabled', checked)}
              />
            </div>

            {/* Discount Configuration (only shown when enabled) */}
            {watchedEnabled && (
              <>
                {/* Discount Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t('discount_type')}
                  </label>
                  <select
                    {...form.register('type')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="percentage">{t('percentage_discount')}</option>
                    <option value="fixed">{t('fixed_discount')}</option>
                  </select>
                </div>

                {/* Discount Value */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {watchedType === 'percentage'
                      ? t('discount_percentage_label')
                      : t('discount_fixed_label')}
                  </label>
                  <input
                    type="number"
                    {...form.register('value', { valueAsNumber: true })}
                    placeholder={watchedType === 'percentage' ? '10' : '5000'}
                    min={0}
                    max={watchedType === 'percentage' ? 100 : undefined}
                    step={watchedType === 'percentage' ? 1 : 100}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  {form.formState.errors.value && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors.value.message}
                    </p>
                  )}
                </div>

                {/* Preview */}
                {watchedValue > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm space-y-1">
                      <p className="font-medium text-blue-900">
                        {t('will_apply_to_services', { count: servicesCount })}
                      </p>
                      <p className="text-xs text-blue-700">
                        {t('individual_discount')} {t('override_global').toLowerCase()}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </FormSection>
      </Form>
    </FormModal>
  )
}
