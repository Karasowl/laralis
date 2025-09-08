'use client'

import { useTranslations } from 'next-intl'
import { FormSection, FormGrid, InputField } from '@/components/ui/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { OnboardingData } from '@/hooks/use-onboarding'

interface ClinicStepProps {
  data: Partial<OnboardingData>
  onChange: (updates: Partial<OnboardingData>) => void
}

export function ClinicStep({ data, onChange }: ClinicStepProps) {
  const t = useTranslations('onboarding')

  return (
    <div className="space-y-6">
      <FormSection>
        <FormGrid columns={1}>
          <InputField
            label={t('clinicStep.nameLabel')}
            value={data.clinicName || ''}
            onChange={(value) => onChange({ clinicName: value })}
            placeholder={t('clinicStep.namePlaceholder')}
            required
          />

          <InputField
            label={t('clinicStep.addressLabel')}
            value={data.clinicAddress || ''}
            onChange={(value) => onChange({ clinicAddress: value })}
            placeholder={t('clinicStep.addressPlaceholder')}
          />
        </FormGrid>

        <FormGrid columns={2}>
          <InputField
            label={t('clinicStep.phoneLabel')}
            value={data.clinicPhone || ''}
            onChange={(value) => onChange({ clinicPhone: value })}
            placeholder={t('clinicStep.phonePlaceholder')}
            type="tel"
          />

          <InputField
            label="Email"
            value={data.clinicEmail || ''}
            onChange={(value) => onChange({ clinicEmail: value })}
            placeholder={t('clinicStep.emailPlaceholder')}
            type="email"
          />
        </FormGrid>
      </FormSection>

      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <Info className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          <strong>{t('notes.title')}</strong> {t('notes.addMoreClinics')}
        </AlertDescription>
      </Alert>
    </div>
  )
}