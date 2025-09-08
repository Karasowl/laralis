'use client'

import { useState, useEffect } from 'react'
import { InputField, SelectField, FormGrid, TextareaField, FormSection } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'
import { toast } from 'sonner'
import { Users, Megaphone, Globe, MapPin } from 'lucide-react'

interface PatientFormUnifiedProps {
  form: any
  campaigns: any[]
  platforms: any[]
  patients: any[]
  t: (key: string) => string
  onCreateCampaign?: (data: any) => Promise<any>
}

export function PatientFormUnified({ 
  form, 
  campaigns, 
  patients,
  platforms,
  t, 
  onCreateCampaign 
}: PatientFormUnifiedProps) {
  const [acquisitionType, setAcquisitionType] = useState<string>('')
  
  // Crear opciones unificadas para el selector de origen
  const sourceOptions = [
    // Campañas activas
    ...campaigns
      .filter(c => c.is_active)
      .map(c => ({
        value: `campaign:${c.id}`,
        label: c.name,
        icon: '📢',
        group: t('acquisition.campaigns'),
        type: 'campaign'
      })),
    
    // Opción de referido
    ...(patients.length > 0 ? [{
      value: 'referral',
      label: t('acquisition.referred_by_patient'),
      icon: '👥',
      group: t('acquisition.referrals'),
      type: 'referral'
    }] : []),
    
    // Plataformas orgánicas
    ...platforms.map(p => ({
      value: `organic:${p.id}`,
      label: p.display_name || p.name,
      icon: '🌐',
      group: t('acquisition.organic'),
      type: 'organic'
    })),
    
    // Visita directa
    {
      value: 'direct',
      label: t('acquisition.direct_visit'),
      icon: '📍',
      group: t('acquisition.direct'),
      type: 'direct'
    }
  ]

  // Manejar cambio en el selector de origen
  const handleSourceChange = (value: string) => {
    // Limpiar campos previos
    form.setValue('campaign_id', null)
    form.setValue('referred_by_patient_id', null)
    form.setValue('platform_id', null)
    
    if (value.startsWith('campaign:')) {
      const campaignId = value.replace('campaign:', '')
      form.setValue('campaign_id', campaignId)
      setAcquisitionType('campaign')
    } else if (value === 'referral') {
      setAcquisitionType('referral')
    } else if (value.startsWith('organic:')) {
      const platformId = value.replace('organic:', '')
      form.setValue('platform_id', platformId)
      setAcquisitionType('organic')
    } else if (value === 'direct') {
      setAcquisitionType('direct')
    }
  }

  // Valor actual del selector basado en los campos del formulario
  const getCurrentSourceValue = () => {
    if (form.watch('campaign_id')) {
      return `campaign:${form.watch('campaign_id')}`
    } else if (form.watch('referred_by_patient_id')) {
      return 'referral'
    } else if (form.watch('platform_id')) {
      return `organic:${form.watch('platform_id')}`
    }
    return 'direct'
  }

  useEffect(() => {
    // Sincronizar el tipo de adquisición con el valor actual
    const currentValue = getCurrentSourceValue()
    if (currentValue.startsWith('campaign:')) {
      setAcquisitionType('campaign')
    } else if (currentValue === 'referral') {
      setAcquisitionType('referral')
    } else if (currentValue.startsWith('organic:')) {
      setAcquisitionType('organic')
    } else {
      setAcquisitionType('direct')
    }
  }, [form.watch('campaign_id'), form.watch('referred_by_patient_id'), form.watch('platform_id')])

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

      <FormSection title={t('acquisition_information')}>
        <FormGrid columns={2}>
          <InputField
            type="date"
            label={t('fields.first_visit_date')}
            value={form.watch('first_visit_date')}
            onChange={(value) => form.setValue('first_visit_date', value)}
            error={form.formState.errors.first_visit_date?.message}
          />
          
          {/* Selector unificado de origen */}
          <div>
            <label className="text-sm font-medium">
              {t('fields.acquisition_source')}
            </label>
            <select
              value={getCurrentSourceValue()}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('select_acquisition_source')}</option>
              
              {/* Agrupar opciones por tipo */}
              {campaigns.filter(c => c.is_active).length > 0 && (
                <optgroup label={t('acquisition.campaigns')}>
                  {campaigns.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={`campaign:${c.id}`}>
                      📢 {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              
              {patients.length > 0 && (
                <optgroup label={t('acquisition.referrals')}>
                  <option value="referral">👥 {t('acquisition.referred_by_patient')}</option>
                </optgroup>
              )}
              
              {platforms.length > 0 && (
                <optgroup label={t('acquisition.organic')}>
                  {platforms.map(p => (
                    <option key={p.id} value={`organic:${p.id}`}>
                      🌐 {p.display_name || p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              
              <optgroup label={t('acquisition.other')}>
                <option value="direct">📍 {t('acquisition.direct_visit')}</option>
              </optgroup>
            </select>
          </div>

          {/* Mostrar selector de paciente referidor si es necesario */}
          {acquisitionType === 'referral' && (
            <SelectField
              label={t('fields.select_referrer')}
              value={form.watch('referred_by_patient_id')}
              onChange={(value) => form.setValue('referred_by_patient_id', value)}
              placeholder={t('select_referrer_patient')}
              options={patients.map((p: any) => ({
                value: p.id,
                label: `${p.first_name} ${p.last_name}`
              }))}
              error={form.formState.errors.referred_by_patient_id?.message}
              required
            />
          )}

          {/* Opción de crear nueva campaña si no hay ninguna activa */}
          {acquisitionType === 'campaign' && campaigns.filter(c => c.is_active).length === 0 && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground mb-2">
                {t('no_active_campaigns')}
              </p>
              <SelectWithCreate
                value=""
                onValueChange={() => {}}
                options={[]}
                placeholder={t('create_new_campaign')}
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
                    name: 'platform_category_id',
                    label: t('settings.marketing.selectPlatform'),
                    type: 'select',
                    required: true,
                    options: platforms.map((p: any) => ({ 
                      value: p.id, 
                      label: p.display_name || p.name 
                    }))
                  },
                  {
                    name: 'budget_cents',
                    label: t('fields.budget'),
                    type: 'number',
                    placeholder: '10000',
                    required: true
                  }
                ]}
                onCreateSubmit={onCreateCampaign}
              />
            </div>
          )}
        </FormGrid>

        {/* Información adicional del origen seleccionado */}
        {acquisitionType && acquisitionType !== 'direct' && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {acquisitionType === 'campaign' && <Megaphone className="h-4 w-4 text-blue-500" />}
              {acquisitionType === 'referral' && <Users className="h-4 w-4 text-green-500" />}
              {acquisitionType === 'organic' && <Globe className="h-4 w-4 text-purple-500" />}
              <span className="text-sm font-medium">
                {acquisitionType === 'campaign' && t('acquisition.campaign_selected')}
                {acquisitionType === 'referral' && t('acquisition.referral_selected')}
                {acquisitionType === 'organic' && t('acquisition.organic_selected')}
              </span>
            </div>
          </div>
        )}

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