'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LayoutDashboard,
  Target,
  Scale,
  Percent,
  FileBarChart
} from 'lucide-react'

const SECTIONS = [
  { key: 'dashboard', icon: LayoutDashboard },
  { key: 'breakEven', icon: Target },
  { key: 'fixedVsVariable', icon: Scale },
  { key: 'margins', icon: Percent },
  { key: 'reports', icon: FileBarChart },
]

export default function FinancesGuidePage() {
  const t = useTranslations('helpPage.guides.finances')

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
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <section.icon className="h-5 w-5 text-amber-600" />
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
