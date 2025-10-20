'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Info, Calculator, DollarSign, TrendingUp, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

interface HeroPricingSystemProps {
  fixedCostPerMinuteCents?: number
  exampleMaterialCostCents?: number
  exampleMarginPct?: number
  exampleFinalPriceCents?: number
}

export function HeroPricingSystem({
  fixedCostPerMinuteCents = 320, // $3.20
  exampleMaterialCostCents = 5000, // $50
  exampleMarginPct = 30,
  exampleFinalPriceCents = 31500 // $315
}: HeroPricingSystemProps) {
  const t = useTranslations('dashboardComponents.heroPricing')
  const [showModal, setShowModal] = useState(false)

  const exampleMinutes = 60
  const exampleFixedCost = fixedCostPerMinuteCents * exampleMinutes

  return (
    <>
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -z-10" />

        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Left side: Title and description */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  {t('title')}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {t('subtitle')}
              </p>

              {/* Visual formula */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                  <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-300">
                    {t('fixedCosts')}: {formatCurrency(exampleFixedCost)}
                  </span>
                </div>

                <span className="text-muted-foreground font-bold">+</span>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
                  <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-900 dark:text-purple-300">
                    {t('materials')}: {formatCurrency(exampleMaterialCostCents)}
                  </span>
                </div>

                <span className="text-muted-foreground font-bold">+</span>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-emerald-900 dark:text-emerald-300">
                    {t('margin')}: {exampleMarginPct}%
                  </span>
                </div>

                <span className="text-muted-foreground font-bold">=</span>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-primary/20 rounded-lg border-2 border-primary/30">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(exampleFinalPriceCents)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: CTA button */}
            <div className="flex-shrink-0">
              <Button
                onClick={() => setShowModal(true)}
                variant="outline"
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                {t('howItWorks')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('modal.title')}
            </DialogTitle>
            <DialogDescription>
              {t('modal.subtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Fixed Costs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                  1
                </div>
                <h4 className="font-semibold text-foreground">{t('modal.step1.title')}</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-10">
                {t('modal.step1.description')}
              </p>
              <div className="pl-10 text-sm font-mono bg-muted p-3 rounded-lg">
                {t('modal.step1.example', {
                  rent: formatCurrency(800000),
                  salaries: formatCurrency(1000000),
                  depreciation: formatCurrency(83333),
                  total: formatCurrency(1883333),
                  minutes: '5,880',
                  perMinute: formatCurrency(320)
                })}
              </div>
            </div>

            {/* Step 2: Variable Costs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                  2
                </div>
                <h4 className="font-semibold text-foreground">{t('modal.step2.title')}</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-10">
                {t('modal.step2.description')}
              </p>
            </div>

            {/* Step 3: Margin */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                  3
                </div>
                <h4 className="font-semibold text-foreground">{t('modal.step3.title')}</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-10">
                {t('modal.step3.description')}
              </p>
            </div>

            {/* Why it's valuable */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('modal.value.title')}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{t('modal.value.point1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{t('modal.value.point2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{t('modal.value.point3')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{t('modal.value.point4')}</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setShowModal(false)}>
                {t('modal.close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
