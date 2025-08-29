'use client'

import { InputField, SelectField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'

interface TreatmentFormProps {
  form: any
  patients: Array<{ value: string; label: string }>
  services: Array<{ value: string; label: string }>
  statusOptions: Array<{ value: string; label: string }>
  onServiceChange: (serviceId: string) => void
  t: (key: string) => string
}

export function TreatmentForm({ 
  form, 
  patients, 
  services, 
  statusOptions, 
  onServiceChange, 
  t 
}: TreatmentFormProps) {
  return (
    <div className="space-y-6">
      <FormSection title={t('treatments.patientAndService')}>
        <FormGrid columns={2}>
          <SelectField
            label={t('treatments.fields.patient')}
            value={form.watch('patient_id')}
            onChange={(value) => form.setValue('patient_id', value)}
            options={patients}
            placeholder={t('treatments.selectPatient')}
            error={form.formState.errors.patient_id?.message}
            required
          />
          
          <SelectField
            label={t('treatments.fields.service')}
            value={form.watch('service_id')}
            onChange={onServiceChange}
            options={services}
            placeholder={t('treatments.selectService')}
            error={form.formState.errors.service_id?.message}
            required
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t('treatments.treatmentDetails')}>
        <FormGrid columns={2}>
          <InputField
            label={t('treatments.fields.date')}
            type="date"
            value={form.watch('treatment_date')}
            onChange={(value) => form.setValue('treatment_date', value as string)}
            error={form.formState.errors.treatment_date?.message}
            required
          />
          
          <InputField
            label={t('treatments.fields.duration')}
            type="number"
            value={form.watch('minutes')}
            onChange={(value) => form.setValue('minutes', parseInt(value as string) || 0)}
            placeholder="30"
            helper={t('treatments.durationHelp')}
            error={form.formState.errors.minutes?.message}
            required
          />
        </FormGrid>
        
        <FormGrid columns={2}>
          <InputField
            label={t('treatments.fields.margin')}
            type="number"
            value={form.watch('margin_pct')}
            onChange={(value) => form.setValue('margin_pct', parseInt(value as string) || 0)}
            placeholder="60"
            helper={t('treatments.marginHelp')}
            error={form.formState.errors.margin_pct?.message}
            required
          />
          
          <SelectField
            label={t('treatments.fields.status')}
            value={form.watch('status')}
            onChange={(value) => form.setValue('status', value as 'pending' | 'completed' | 'cancelled')}
            options={statusOptions}
            placeholder={t('treatments.selectStatus')}
            error={form.formState.errors.status?.message}
            required
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t('treatments.additionalInfo')}>
        <TextareaField
          label={t('treatments.fields.notes')}
          value={form.watch('notes')}
          onChange={(value) => form.setValue('notes', value)}
          placeholder={t('treatments.notesPlaceholder')}
          error={form.formState.errors.notes?.message}
          rows={3}
        />
      </FormSection>
    </div>
  )
}