'use client'

import { InputField, SelectField, TextareaField, FormGrid, FormSection } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'

interface TreatmentFormProps {
  form: any
  patients: Array<{ value: string; label: string }>
  services: Array<{ value: string; label: string }>
  statusOptions: Array<{ value: string; label: string }>
  onServiceChange: (serviceId: string) => void
  onCreatePatient?: (data: any) => Promise<any>
  onCreateService?: (data: any) => Promise<any>
  t: (key: string) => string
}

export function TreatmentForm({ 
  form, 
  patients, 
  services, 
  statusOptions, 
  onServiceChange,
  onCreatePatient,
  onCreateService,
  t 
}: TreatmentFormProps) {
  return (
    <div className="space-y-6">
      <FormSection title={t('treatments.patientAndService')}>
        <FormGrid columns={2}>
          <div>
            <label className="text-sm font-medium">
              {t('treatments.fields.patient')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <SelectWithCreate
              value={form.watch('patient_id')}
              onValueChange={(value) => form.setValue('patient_id', value)}
              options={patients}
              placeholder={t('treatments.selectPatient')}
              canCreate={true}
              createLabel={t('patients.addPatient')}
              entityName={t('entities.patient')}
              createDialogTitle={t('patients.create_title')}
              createDialogDescription={t('patients.create_quick_description')}
              createFields={[
                {
                  name: 'first_name',
                  label: t('fields.first_name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'last_name',
                  label: t('fields.last_name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'phone',
                  label: t('fields.phone'),
                  type: 'tel',
                  required: false
                }
              ]}
              onCreateSubmit={onCreatePatient}
            />
            {form.formState.errors.patient_id?.message && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.patient_id?.message}</p>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium">
              {t('treatments.fields.service')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <SelectWithCreate
              value={form.watch('service_id')}
              onValueChange={onServiceChange}
              options={services}
              placeholder={t('treatments.selectService')}
              canCreate={true}
              createLabel={t('services.addService', 'Agregar Servicio')}
              entityName={t('entities.service')}
              createDialogTitle={t('services.create_title')}
              createDialogDescription={t('services.create_quick_description')}
              createFields={[
                {
                  name: 'name',
                  label: t('fields.name'),
                  type: 'text',
                  required: true
                },
                {
                  name: 'duration_minutes',
                  label: t('fields.duration'),
                  type: 'number',
                  placeholder: '30',
                  required: true
                }
              ]}
              onCreateSubmit={onCreateService}
            />
            {form.formState.errors.service_id?.message && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.service_id?.message}</p>
            )}
          </div>
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
