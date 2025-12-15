'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { DollarSign, Target, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FinancialBaseProps {
  fixedCostsCents: number
  breakEvenRevenueCents: number
}

export function FinancialBase({ fixedCostsCents, breakEvenRevenueCents }: FinancialBaseProps) {
  const t = useTranslations('equilibrium')

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{t('sections.financialBase')}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{t('sections.financialBaseTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Fixed Costs Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('fixed_costs')}</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(fixedCostsCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('monthly_fixed')}
            </p>
          </CardContent>
        </Card>

        {/* Break-even Card */}
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('break_even')}</CardTitle>
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Target className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {formatCurrency(breakEvenRevenueCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('minimum_revenue')}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('sections.financialBaseDescription', { breakEven: formatCurrency(breakEvenRevenueCents) })}
      </p>
    </section>
  )
}
