'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Building,
  Clock,
  Briefcase,
  Users,
  Lightbulb,
  CheckCircle2
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const STEPS = [
  { key: 'step1', icon: Building2 },
  { key: 'step2', icon: Building },
  { key: 'step3', icon: Clock },
  { key: 'step4', icon: Briefcase },
  { key: 'step5', icon: Users },
]

export default function GettingStartedPage() {
  const t = useTranslations('helpPage.guides.gettingStarted')

  return (
    <div className="container max-w-3xl py-8 px-4 md:px-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        backHref="/help"
        backLabel={t.raw('backToHelp') || 'Back to Help'}
      />

      <div className="mt-8 space-y-6">
        {/* Intro */}
        <p className="text-lg text-muted-foreground">
          {t('intro')}
        </p>

        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step, index) => (
            <Card key={step.key}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <step.icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{t(`${step.key}.title`)}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-[4.5rem]">
                <p className="text-muted-foreground">
                  {t(`${step.key}.content`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tip */}
        <Alert className="bg-primary/5 border-primary/20">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">
            {t('tip')}
          </AlertDescription>
        </Alert>

        {/* Success indicator */}
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">
            {t.raw('completed') || '¡Listo! Ya puedes empezar a usar Laralis.'}
          </span>
        </div>
      </div>
    </div>
  )
}
