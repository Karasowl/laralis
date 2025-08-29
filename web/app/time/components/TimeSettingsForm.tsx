'use client'

import { FormSection, FormGrid, InputField } from '@/components/ui/form-field'
import { Form } from '@/components/ui/form'
import { useTranslations } from 'next-intl'

interface TimeSettingsFormProps {
  form: any
}

export function TimeSettingsForm({ form }: TimeSettingsFormProps) {
  const t = useTranslations('time')
  
  return (
    <Form {...form}>
      <FormSection title={t('work_configuration')}>
        <FormGrid columns={1}>
          <InputField
            type="number"
            label={t('work_days_per_month')}
            value={form.watch('work_days')}
            onChange={(value) => form.setValue('work_days', parseInt(value as string))}
            placeholder="20"
            min={1}
            max={31}
            error={form.formState.errors.work_days?.message}
          />
          
          <InputField
            type="number"
            label={t('hours_per_day')}
            value={form.watch('hours_per_day')}
            onChange={(value) => form.setValue('hours_per_day', parseInt(value as string))}
            placeholder="7"
            min={1}
            max={24}
            error={form.formState.errors.hours_per_day?.message}
          />
          
          <InputField
            type="number"
            label={t('productivity_percentage')}
            value={form.watch('real_pct')}
            onChange={(value) => form.setValue('real_pct', parseInt(value as string))}
            placeholder="80"
            min={1}
            max={100}
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