'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  UserPlus,
  History,
  Wallet,
  Target,
  Download
} from 'lucide-react'

const SECTIONS = [
  { key: 'addPatient', icon: UserPlus },
  { key: 'patientHistory', icon: History },
  { key: 'pendingBalance', icon: Wallet },
  { key: 'acquisitionSource', icon: Target },
  { key: 'export', icon: Download },
]

export default function PatientsGuidePage() {
  const t = useTranslations('helpPage.guides.patients')

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

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <Card key={section.key}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <section.icon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-lg">{t(`${section.key}.title`)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t(`${section.key}.content`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
