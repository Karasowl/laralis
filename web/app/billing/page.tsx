'use client'

import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Gift,
  Check,
  Sparkles,
  CreditCard,
  Calendar,
  Zap,
  Shield,
  HeartHandshake
} from 'lucide-react'

export default function BillingPage() {
  const t = useTranslations('billing')

  const features = [
    { icon: Zap, text: t('features.unlimited') },
    { icon: Shield, text: t('features.secure') },
    { icon: HeartHandshake, text: t('features.support') },
  ]

  return (
    <div className="container max-w-3xl py-8 px-4 md:px-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />

      <div className="space-y-8 mt-8">
        {/* Hero Card - Trial Status */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
                <Gift className="h-12 w-12" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-center mb-2">
              {t('trial.title')}
            </h2>
            <p className="text-center text-white/90 text-lg">
              {t('trial.subtitle')}
            </p>
          </div>

          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Badge variant="secondary" className="text-lg px-6 py-2 mb-4">
                <Sparkles className="h-4 w-4 mr-2" />
                {t('trial.status')}
              </Badge>
              <p className="text-muted-foreground">
                {t('trial.message')}
              </p>
            </div>

            {/* Features included */}
            <div className="border-t pt-6">
              <h3 className="font-medium mb-4 text-center">{t('trial.includes')}</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = feature.icon
                  return (
                    <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm">{feature.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('currentPlan.title')}
            </CardTitle>
            <CardDescription>{t('currentPlan.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-semibold text-lg">{t('currentPlan.planName')}</p>
                <p className="text-sm text-muted-foreground">{t('currentPlan.planDetails')}</p>
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
                {t('currentPlan.active')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade CTA (disabled for now) */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('upgrade.title')}
            </CardTitle>
            <CardDescription>{t('upgrade.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full" size="lg">
              {t('upgrade.button')}
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {t('upgrade.comingSoon')}
            </p>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground">
          <p>{t('footer.questions')}</p>
          <a href="mailto:soporte@laralis.com" className="text-primary hover:underline">
            soporte@laralis.com
          </a>
        </div>
      </div>
    </div>
  )
}
