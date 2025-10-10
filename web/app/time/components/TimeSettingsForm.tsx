'use client'

import { FormSection, FormGrid, InputField } from '@/components/ui/form-field'
import type { UseFormReturn } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { useTranslations } from 'next-intl'

type TimeSettingsFormValues = {
  work_days: number
  hours_per_day: number
  real_pct: number
}

interface TimeSettingsFormProps {
  form: UseFormReturn<TimeSettingsFormValues>
}

export function TimeSettingsForm({ form }: TimeSettingsFormProps) {
  const t = useTranslations('time')
  const v = useTranslations('validation')
  
  return (
    <Form {...form}>
      <FormSection title={t('work_configuration')}>
        <FormGrid columns={1}>
          <InputField
            type="number"
            label={t('work_days_per_month')}
            value={Number(form.watch('work_days') || 0)}
            onChange={(value) => form.setValue('work_days', Number(value) || 0)}
            placeholder={v('placeholders.defaultDays20')}
            min={1}
            max={31}
            error={form.formState.errors.work_days?.message}
          />
          
          <InputField
            type="number"
            label={t('hours_per_day')}
            value={Number(form.watch('hours_per_day') || 0)}
            onChange={(value) => form.setValue('hours_per_day', Number(value) || 0)}
            placeholder={v('placeholders.defaultHours7')}
            min={1}
            max={16}
            helperText={t('min_hours_help')}
            error={form.formState.errors.hours_per_day?.message}
          />
          
          <InputField
            type="number"
            label={t('productivity_percentage')}
            value={Number(form.watch('real_pct') || 0)}
            onChange={(value) => form.setValue('real_pct', Number(value) || 0)}
            placeholder={v('placeholders.defaultPercentage80')}
            min={50}
            max={95}
            error={form.formState.errors.real_pct?.message}
          />
        </FormGrid>
        
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            {t('settings_explanation')}
          </p>
        </div>
      </FormSection>
    </Form>
  )
}
