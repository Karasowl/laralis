'use client'

import { SelectField } from '@/components/ui/form-field'
import { SelectWithCreate } from '@/components/ui/select-with-create'

interface PatientFormProps {
  form: any
  patientSources: any[]
  campaigns: any[]
  platforms: any[]
  patients: any[]
  t: (key: string) => string
  onCreatePatientSource: (name: string) => Promise<any>
  onCreateCampaign: (data: any) => Promise<any>
}

export function PatientFormMarketing({
  form, 
  patientSources, 
  campaigns, 
  patients,
  platforms,
  t, 
  onCreatePatientSource,
  onCreateCampaign
}: PatientFormProps) {
  // Obtener el source seleccionado
  const selectedSourceId = form.watch('source_id')
  const selectedSource = patientSources.find(s => s.id === selectedSourceId)
  const sourceType = selectedSource?.name

  return (
    <div className="space-y-4">
      {/* 1. Vía Principal de Llegada (Solo 4 opciones) */}
      <div>
        <label className="text-sm font-medium mb-1 block">
          {t('fields.acquisition_source')} <span className="text-red-500">*</span>
        </label>
        <SelectField
          value={form.watch('source_id')}
          onChange={(value) => {
            form.setValue('source_id', value)
            // Limpiar campos dependientes cuando cambia la vía
            form.setValue('campaign_id', '')
            form.setValue('referred_by_patient_id', '')
            form.setValue('platform_id', '')
          }}
          placeholder={t('select_acquisition_source')}
          options={patientSources.map((source: any) => ({
            value: source.id,
            label: source.display_name
          }))}
          error={form.formState.errors.source_id?.message}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {t('acquisition_source_help')}
        </p>
      </div>

      {/* 2. Campos condicionales según la vía seleccionada */}
      
      {/* Si es CAMPAÑA -> Seleccionar campaña */}
      {sourceType === 'campaign' && (
        <div className="pl-4 border-l-2 border-primary/20">
          <label className="text-sm font-medium mb-1 block">
            {t('fields.campaign')} <span className="text-red-500">*</span>
          </label>
          <SelectWithCreate
            value={form.watch('campaign_id')}
            onValueChange={(value) => form.setValue('campaign_id', value)}
            options={campaigns.map((c: any) => ({
              value: c.id,
              label: `${c.name} (${c.platform?.display_name || 'Sin plataforma'})`
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
                options: platforms.map((p: any) => ({ 
                  value: p.id, 
                  label: p.display_name || p.name 
                }))
              },
              {
                name: 'start_date',
                label: t('fields.start_date'),
                type: 'date',
                required: false
              },
              {
                name: 'budget',
                label: t('fields.budget'),
                type: 'number',
                placeholder: '0.00',
                required: false
              }
            ]}
            onCreateSubmit={onCreateCampaign}
          />
          {form.formState.errors.campaign_id?.message && (
            <p className="text-sm text-red-500 mt-1">
              {form.formState.errors.campaign_id?.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {t('campaign_help')}
          </p>
        </div>
      )}

      {/* Si es REFERIDO -> Seleccionar paciente que refirió */}
      {sourceType === 'referral' && (
        <div className="pl-4 border-l-2 border-emerald-500/20">
          <label className="text-sm font-medium mb-1 block">
            {t('fields.referred_by')} <span className="text-red-500">*</span>
          </label>
          <SelectField
            value={form.watch('referred_by_patient_id')}
            onChange={(value) => form.setValue('referred_by_patient_id', value)}
            placeholder={
              patients.length === 0 
                ? t('no_patients_for_referral') 
                : t('select_referrer')
            }
            options={patients.length === 0 ? [] : patients.map((p: any) => ({
              value: p.id,
              label: `${p.first_name} ${p.last_name}`
            }))}
            error={form.formState.errors.referred_by_patient_id?.message}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t('referral_help')}
          </p>
        </div>
      )}

      {/* Si es ORGÁNICO -> Seleccionar plataforma */}
      {sourceType === 'organic' && (
        <div className="pl-4 border-l-2 border-blue-500/20">
          <label className="text-sm font-medium mb-1 block">
            {t('fields.platform')} <span className="text-red-500">*</span>
          </label>
          <SelectField
            value={form.watch('platform_id')}
            onChange={(value) => form.setValue('platform_id', value)}
            placeholder={t('select_platform')}
            options={platforms.map((p: any) => ({
              value: p.id,
              label: p.display_name || p.name
            }))}
            error={form.formState.errors.platform_id?.message}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t('organic_platform_help')}
          </p>
        </div>
      )}

      {/* Si es DIRECTO -> No se necesita información adicional */}
      {sourceType === 'direct' && (
        <div className="pl-4 border-l-2 border-gray-500/20">
          <p className="text-sm text-muted-foreground italic">
            {t('direct_acquisition_info')}
          </p>
        </div>
      )}

      {/* Información visual del flujo seleccionado */}
      {selectedSourceId && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs font-medium mb-1">{t('acquisition_summary')}:</p>
          <p className="text-sm">
            {sourceType === 'campaign' && form.watch('campaign_id') && (
              <>📢 {t('patient_from_campaign')}</>
            )}
            {sourceType === 'referral' && form.watch('referred_by_patient_id') && (
              <>👥 {t('patient_from_referral')}</>
            )}
            {sourceType === 'organic' && form.watch('platform_id') && (
              <>🌐 {t('patient_from_organic')}</>
            )}
            {sourceType === 'direct' && (
              <>🚶 {t('patient_from_direct')}</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}