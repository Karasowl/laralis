'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ContentLayout } from '@/components/layouts/ContentLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText } from 'lucide-react'

export default function TermsPage() {
  const t = useTranslations('terms')
  const router = useRouter()

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const sections = [
    'acceptance',
    'description',
    'registration',
    'dataUsage',
    'privacy',
    'prohibitedUse',
    'liability',
    'modifications',
    'termination',
    'contact'
  ] as const

  return (
    <ContentLayout>
      <div className="max-w-5xl mx-auto">
        <Card className="border-2 shadow-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl">
          <CardHeader className="text-center border-b pb-6 sm:pb-8 px-6 sm:px-8 lg:px-12">
            <div className="mx-auto mb-4 sm:mb-6 h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl sm:text-4xl lg:text-5xl font-bold">{t('title')}</CardTitle>
            <p className="text-sm sm:text-base text-muted-foreground mt-3">
              {t('lastUpdated', { date: currentDate })}
            </p>
          </CardHeader>

          <CardContent className="space-y-8 sm:space-y-10 pt-6 sm:pt-8 px-6 sm:px-8 lg:px-12 pb-8">
            {sections.map((section) => (
              <div key={section} className="space-y-3 sm:space-y-4">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground">
                  {t(`sections.${section}.title`)}
                </h2>
                <p className="text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed whitespace-pre-line">
                  {t(`sections.${section}.content`)}
                </p>
              </div>
            ))}

            <div className="pt-4 sm:pt-6 border-t">
              <Button
                onClick={() => router.back()}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToHome')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentLayout>
  )
}
