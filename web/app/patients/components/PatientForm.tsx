'use client'

import { InputField, SelectField, FormGrid, TextareaField, FormSection } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'
import { toast } from 'sonner'

interface PatientFormProps {
  form: any
  patientSources: any[]
  campaigns: any[]
  patients: any[]
  t: (key: string) => string
  onCreatePatientSource?: (data: any) => Promise<any>
  onCreateCampaign?: (data: any) => Promise<any>
}

export function PatientForm({ 
  form, 
  patientSources, 
  campaigns, 
  patients, 
  t, 
  onCreatePatientSource,
  onCreateCampaign 
}: PatientFormProps) {
  return (
    <div className="space-y-6">
      <FormSection title={t('personal_information')}>
        <FormGrid columns={2}>
          <InputField
            label={t('fields.first_name')}
            value={form.watch('first_name')}
            onChange={(value) => form.setValue('first_name', value)}
            error={form.formState.errors.first_name?.message}
            required
          />
          <InputField
            label={t('fields.last_name')}
            value={form.watch('last_name')}
            onChange={(value) => form.setValue('last_name', value)}
            error={form.formState.errors.last_name?.message}
            required
          />
          <InputField
            type="email"
            label={t('fields.email')}
            value={form.watch('email')}
            onChange={(value) => form.setValue('email', value)}
            error={form.formState.errors.email?.message}
          />
          <InputField
            type="tel"
            label={t('fields.phone')}
            value={form.watch('phone')}
            onChange={(value) => form.setValue('phone', value)}
            error={form.formState.errors.phone?.message}
          />
          <InputField
            type="date"
            label={t('fields.birth_date')}
            value={form.watch('birth_date')}
            onChange={(value) => form.setValue('birth_date', value)}
            error={form.formState.errors.birth_date?.message}
          />
          <SelectField
            label={t('fields.gender')}
            value={form.watch('gender')}
            onChange={(value) => form.setValue('gender', value)}
            placeholder={t('select_gender')}
            options={[
              { value: 'male', label: t('gender.male') },
              { value: 'female', label: t('gender.female') }
            ]}
            error={form.formState.errors.gender?.message}
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t('address_information')}>
        <FormGrid columns={1}>
          <InputField
            label={t('fields.address')}
            value={form.watch('address')}
            onChange={(value) => form.setValue('address', value)}
            error={form.formState.errors.address?.message}
          />
        </FormGrid>
        <FormGrid columns={2}>
          <InputField
            label={t('fields.city')}
            value={form.watch('city')}
            onChange={(value) => form.setValue('city', value)}
            error={form.formState.errors.city?.message}
          />
          <InputField
            label={t('fields.postal_code')}
            value={form.watch('postal_code')}
            onChange={(value) => form.setValue('postal_code', value)}
            error={form.formState.errors.postal_code?.message}
          />
        </FormGrid>
      </FormSection>

      <FormSection title={t('clinic_information')}>
        <FormGrid columns={2}>
          <InputField
            type="date"
            label={t('fields.first_visit_date')}
            value={form.watch('first_visit_date')}
            onChange={(value) => form.setValue('first_visit_date', value)}
            error={form.formState.errors.first_visit_date?.message}
          />
          <div>
            <label className="text-sm font-medium">
              {t('fields.source')}
            </label>
            <SelectWithCreate
              value={form.watch('source_id')}
              onValueChange={(value) => form.setValue('source_id', value)}
              options={patientSources.map((source: any) => ({
                value: source.id,
                label: source.name
              }))}
              placeholder={t('select_source')}
              canCreate={true}
              entityName={t('entities.source')}
              createDialogTitle={t('create_source_title')}
              createDialogDescription={t('create_source_description')}
              createFields={[
                {
                  name: 'name',
                  label: t('fields.name'),
                  type: 'text',
                  placeholder: t('source_name_placeholder'),
                  required: true
                },
                {
                  name: 'description',
                  label: t('fields.description'),
                  type: 'textarea',
                  placeholder: t('source_description_placeholder'),
                  required: false
                }
              ]}
              onCreateSubmit={onCreatePatientSource}
            />
            {form.formState.errors.source_id?.message && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.source_id?.message}</p>
            )}
          </div>
          <SelectField
            label={t('fields.referred_by')}
            value={form.watch('referred_by_patient_id')}
            onChange={(value) => form.setValue('referred_by_patient_id', value)}
            options={patients.map((p: any) => ({
              value: p.id,
              label: `${p.first_name} ${p.last_name}`
            }))}
            error={form.formState.errors.referred_by_patient_id?.message}
          />
          <div>
            <label className="text-sm font-medium">
              {t('fields.campaign')}
            </label>
            <SelectWithCreate
              value={form.watch('campaign_id')}
              onValueChange={(value) => form.setValue('campaign_id', value)}
              options={campaigns.map((c: any) => ({
                value: c.id,
                label: c.name
              }))}
              placeholder={t('select_campaign')}
              canCreate={true}
              entityName={t('entities.campaign')}
              createDialogTitle={t('create_campaign_title')}
              createDialogDescription={t('create_campaign_description')}
              createFields={[
                {
                  name: 'name',
                  label: t('fields.name'),
                  type: 'text',
                  placeholder: t('campaign_name_placeholder'),
                  required: true
                },
                {
                  name: 'platform_id',
                  label: t('fields.platform'),
                  type: 'select',
                  required: true,
                  options: [] // Esto se llenará desde el componente padre
                },
                {
                  name: 'budget_cents',
                  label: t('fields.budget'),
                  type: 'number',
                  placeholder: '0.00',
                  required: false
                }
              ]}
              onCreateSubmit={onCreateCampaign}
            />
            {form.formState.errors.campaign_id?.message && (
              <p className="text-sm text-red-500 mt-1">{form.formState.errors.campaign_id?.message}</p>
            )}
          </div>
        </FormGrid>
        <TextareaField
          label={t('fields.notes')}
          value={form.watch('notes')}
          onChange={(value) => form.setValue('notes', value)}
          placeholder={t('notes_placeholder')}
          rows={3}
          error={form.formState.errors.notes?.message}
        />
      </FormSection>
    </div>
  )
}