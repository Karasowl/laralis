'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { InputField, FormGrid, TextareaField, FormSection } from '@/components/ui/form-field'
import { TouchRadioGroup } from '@/components/ui/mobile-form-advanced'
import { Users, Megaphone, Globe } from 'lucide-react'

interface PatientFormUnifiedProps {
  form: any
  campaigns: any[]
  platforms: any[]
  patients: any[]
  patientSources: any[]
  t: (key: string) => string
  onCreateCampaign?: (data: any) => Promise<any>
}

export function PatientFormUnified({
  form,
  campaigns,
  patients,
  platforms,
  patientSources,
  t,
  onCreateCampaign
}: PatientFormUnifiedProps) {
  const tCommon = useTranslations('common')
  const [acquisitionType, setAcquisitionType] = useState<string>('')
  const [createCampaignMode, setCreateCampaignMode] = useState<boolean>(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignPlatform, setNewCampaignPlatform] = useState('')
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const newCampaignNameRef = useRef<HTMLInputElement | null>(null)
  const activeCampaigns = Array.isArray(campaigns) ? campaigns.filter((c: any) => c?.is_active) : []
  // Cambio de tipo de adquisición: limpia campos y muestra controles específicos
  const handleAcquisitionTypeChange = (value: string) => {
    setAcquisitionType(value)
    // Limpiar campos relacionados
    form.setValue('campaign_id', '')
    form.setValue('referred_by_patient_id', '')
    form.setValue('platform_id', '')

    // MAPEO DE ACQUISITION TYPE A SOURCE
    // Mapeo correcto según los nombres creados por el trigger insert_default_patient_sources
    const sourceMap: Record<string, string> = {
      'direct': 'Otro',  // Genérico para directo
      'campaign': 'Campaña',
      'referral': 'Recomendación',
      'organic': 'Google'  // Por defecto Google para orgánico
    }

    // Buscar el patient_source por nombre
    const sourceName = sourceMap[value]
    if (sourceName && patientSources) {
      const source = patientSources.find((s: any) =>
        s.name?.toLowerCase() === sourceName.toLowerCase()
      )
      if (source) {
        form.setValue('source_id', source.id)
      }
    }

    // Activar modo creación si no hay campañas activas
    if (value === 'campaign') {
      setCreateCampaignMode(activeCampaigns.length === 0)
    } else {
      setCreateCampaignMode(false)
    }
  }

  // Debug simple para verificar montaje correcto en el navegador
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[PFU] PatientFormUnified v2 mounted');
    }
  }, [])

  useEffect(() => {
    if (!createCampaignMode) return
    if (typeof window === 'undefined') return
    const id = window.requestAnimationFrame(() => {
      try { newCampaignNameRef.current?.focus() } catch {}
    })
    return () => window.cancelAnimationFrame(id)
  }, [createCampaignMode])

  // Inicializar el valor del selector desde los campos si ya vienen con datos
  useEffect(() => {
    const campaign = form.getValues?.('campaign_id')
    const refBy = form.getValues?.('referred_by_patient_id')
    const platform = form.getValues?.('platform_id')
    if (campaign) {
      setAcquisitionType('campaign')
    } else if (refBy) {
      setAcquisitionType('referral')
    } else if (platform) {
      setAcquisitionType('organic')
    } else {
      setAcquisitionType('direct')
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6" data-cy="pf-unified-v2">
      <FormSection title={t('personal_information')}>
        <FormGrid columns={2}>
          <InputField
            label={t('fields.first_name')}
            value={form.watch('first_name')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('first_name', val)
            }}
            error={form.formState.errors.first_name?.message}
            required
          />
          <InputField
            label={t('fields.last_name')}
            value={form.watch('last_name')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('last_name', val)
            }}
            error={form.formState.errors.last_name?.message}
            required
          />
          <InputField
            type="email"
            label={t('fields.email')}
            value={form.watch('email')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('email', val)
            }}
            error={form.formState.errors.email?.message}
          />
          <InputField
            type="text"
            label={t('fields.phone')}
            value={form.watch('phone')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('phone', val)
            }}
            error={form.formState.errors.phone?.message}
          />
          <InputField
            type="date"
            label={t('fields.birth_date')}
            value={form.watch('birth_date')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('birth_date', val)
            }}
            error={form.formState.errors.birth_date?.message}
          />
          <div>
            <label className="text-sm font-medium">
              {t('fields.gender')}
            </label>
            <select
              value={form.watch('gender') || ''}
              onChange={(e) => form.setValue('gender', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('select_gender')}</option>
              <option value="male">{t('gender.male')}</option>
              <option value="female">{t('gender.female')}</option>
            </select>
            {form.formState.errors.gender?.message && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.gender?.message}</p>
            )}
          </div>
        </FormGrid>
      </FormSection>

      <FormSection title={t('address_information')}>
        <FormGrid columns={1}>
          <InputField
            label={t('fields.address')}
            value={form.watch('address')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('address', val)
            }}
            error={form.formState.errors.address?.message}
          />
        </FormGrid>
        <FormGrid columns={2}>
          <InputField
            label={t('fields.city')}
            value={form.watch('city')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('city', val)
            }}
            error={form.formState.errors.city?.message}
          />
          <InputField
            label={t('fields.postal_code')}
            value={form.watch('postal_code')}
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('postal_code', val)
            }}
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
            onChange={(e) => {
              const val = typeof e === 'object' && 'target' in e ? e.target.value : e
              form.setValue('first_visit_date', val)
            }}
            error={form.formState.errors.first_visit_date?.message}
          />

          {/* Tipo de origen: radio claro y separado */}
          <TouchRadioGroup
            label={t('fields.acquisition_source')}
            value={acquisitionType}
            onChange={handleAcquisitionTypeChange}
            options={[
              { value: 'campaign', label: t('acquisition.campaigns') },
              { value: 'referral', label: t('acquisition.referrals') },
              { value: 'organic', label: t('acquisition.organic') },
              { value: 'direct', label: t('acquisition.direct') },
            ]}
          />

          {/* Mostrar selector de paciente referidor si es necesario */}
          {/* Dependientes por tipo de origen */}
          {acquisitionType === 'campaign' && (
            <div className="col-span-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{t('fields.campaign')}</label>
                <select
                  value={form.watch('campaign_id') || ''}
                  onChange={(e) => form.setValue('campaign_id', e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">{t('select_campaign')}</option>
                  {activeCampaigns.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="px-3 py-2 border rounded-md text-sm"
                  onClick={() => {
                    if (!createCampaignMode) {
                      setCreateCampaignMode(true)
                      return
                    }
                    try { newCampaignNameRef.current?.focus() } catch {}
                  }}
                >
                  {t('create_new_campaign')}
                </button>
              </div>
            </div>
          )}

          {acquisitionType === 'referral' && (
            <div>
              <label className="text-sm font-medium">{t('fields.select_referrer')}</label>
              <select
                value={form.watch('referred_by_patient_id') || ''}
                onChange={(e) => form.setValue('referred_by_patient_id', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('select_referrer_patient')}</option>
                {patients.map((p: any) => (
                  <option key={p.id} value={p.id}>{`${p.first_name} ${p.last_name}`}</option>
                ))}
              </select>
            </div>
          )}

          {acquisitionType === 'organic' && (
            <div>
              <label className="text-sm font-medium">{t('fields.platform')}</label>
              <select
                value={form.watch('platform_id') || ''}
                onChange={(e) => form.setValue('platform_id', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('select_platform')}</option>
                {platforms.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Opción de crear nueva campaña si no hay ninguna activa */}
          {acquisitionType === 'campaign' && (createCampaignMode || activeCampaigns.length === 0) && (
            <div className="col-span-2 space-y-3 border rounded-md p-3">
              <p className="text-sm font-medium">{t('create_campaign_title')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <InputField
                  label={t('fields.name')}
                  value={newCampaignName}
                  onChange={(e) => {
                    const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                    setNewCampaignName(String(val))
                  }}
                  placeholder={t('campaign_name_placeholder')}
                  inputRef={newCampaignNameRef}
                  required
                />
                <div>
                  <label className="text-sm font-medium">
                    {t('fields.platform')}
                  </label>
                  <select
                    value={newCampaignPlatform}
                    onChange={(e) => setNewCampaignPlatform(String(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t('select_platform')}</option>
                    {platforms.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded-md"
                  onClick={() => {
                    setCreateCampaignMode(false)
                    setNewCampaignName('')
                    setNewCampaignPlatform('')
                  }}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                  disabled={creatingCampaign || !newCampaignName || !newCampaignPlatform}
                  onClick={async () => {
                    if (!onCreateCampaign) return
                    try {
                      setCreatingCampaign(true)
                      const option = await onCreateCampaign({
                        name: newCampaignName,
                        platform_id: newCampaignPlatform
                      })
                      if (option?.value) {
                        form.setValue('campaign_id', option.value)
                        setCreateCampaignMode(false)
                        setNewCampaignName('')
                        setNewCampaignPlatform('')
                      }
                    } finally {
                      setCreatingCampaign(false)
                    }
                  }}
                >
                  {creatingCampaign ? tCommon('saving') : tCommon('create')}
                </button>
              </div>
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
          onChange={(e) => {
            const val = typeof e === 'object' && 'target' in e ? e.target.value : e
            form.setValue('notes', val)
          }}
          placeholder={t('notes_placeholder')}
          rows={3}
          error={form.formState.errors.notes?.message}
        />
      </FormSection>
    </div>
  )
}
