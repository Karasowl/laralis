'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Check, Building2, Stethoscope } from 'lucide-react'
import { OnboardingData } from '@/hooks/use-onboarding'

interface CompleteStepProps {
  data: Partial<OnboardingData>
}

export function CompleteStep({ data }: CompleteStepProps) {
  const t = useTranslations('onboarding')

  const nextSteps = [
    t('doneStep.todo.time'),
    t('doneStep.todo.fixed'),
    t('doneStep.todo.supplies'),
    t('doneStep.todo.services'),
    t('doneStep.todo.tariffs')
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold">{t('doneStep.doneHeadline')}</h3>
          <p className="text-muted-foreground mt-2">{t('doneStep.created')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{data.workspaceName}</span>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <Stethoscope className="h-4 w-4 text-green-600" />
            <span>{data.clinicName}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="font-medium">{t('doneStep.nextSteps')}</p>
        <ul className="space-y-1">
          {nextSteps.map((step, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-600 mt-0.5" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}