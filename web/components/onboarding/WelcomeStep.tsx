'use client'

import { useTranslations } from 'next-intl'
import { Calculator, Users, TrendingUp, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function WelcomeStep() {
  const t = useTranslations('onboarding')

  const features = [
    {
      icon: Calculator,
      title: t('features.calc.title'),
      description: t('features.calc.desc')
    },
    {
      icon: Users,
      title: t('features.multi.title'),
      description: t('features.multi.desc')
    },
    {
      icon: TrendingUp,
      title: t('features.reports.title'),
      description: t('features.reports.desc')
    },
    {
      icon: Settings,
      title: t('features.custom.title'),
      description: t('features.custom.desc')
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">{t('welcomeBody')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-default">
              <CardContent className="p-4 cursor-default">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-1">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}