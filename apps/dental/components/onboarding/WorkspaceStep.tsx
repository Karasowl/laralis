'use client'

import type { ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { FormSection, FormGrid, InputField, TextareaField } from '@/components/ui/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lightbulb } from 'lucide-react'
import { OnboardingData } from '@/hooks/use-onboarding'

interface WorkspaceStepProps {
  data: Partial<OnboardingData>
  onChange: (updates: Partial<OnboardingData>) => void
}

type FieldChange = string | number | ChangeEvent<HTMLInputElement | HTMLTextAreaElement>

function fieldValue(value: FieldChange) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value.target.value
}

export function WorkspaceStep({ data, onChange }: WorkspaceStepProps) {
  const t = useTranslations('onboarding')

  return (
    <div className="space-y-6">
      <FormSection>
        <FormGrid columns={1}>
          <InputField
            id="onboarding-workspace-name"
            label={t('workspaceStep.nameLabel')}
            value={data.workspaceName || ''}
            onChange={(value: FieldChange) => onChange({ workspaceName: fieldValue(value) })}
            placeholder={t('workspaceStep.namePlaceholder')}
            helperText={t('workspaceStep.nameHelp')}
            required
          />

          <TextareaField
            id="onboarding-workspace-description"
            label={t('workspaceStep.descLabel')}
            value={data.workspaceType || ''}
            onChange={(value: FieldChange) => onChange({ workspaceType: fieldValue(value) })}
            placeholder={t('workspaceStep.descPlaceholder')}
            rows={3}
          />
        </FormGrid>
      </FormSection>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>{t('tips.title')}</strong> {t('tips.workspaceMulti')}
        </AlertDescription>
      </Alert>
    </div>
  )
}
