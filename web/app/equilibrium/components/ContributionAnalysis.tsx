'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ContributionAnalysisProps {
  variableCostPercentage: number
  contributionMargin: number
  variableCostSource: 'calculated' | 'fallback'
  autoVariableCostPercentage: number
  autoVariableCostSampleSize: number
  autoVariableCostPeriodDays: number
}

export function ContributionAnalysis({
  variableCostPercentage,
  contributionMargin,
  variableCostSource,
  autoVariableCostPercentage,
  autoVariableCostSampleSize,
  autoVariableCostPeriodDays,
}: ContributionAnalysisProps) {
  const t = useTranslations('equilibrium')

  const formatPercent = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{t('sections.costBreakdown')}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{t('sections.costBreakdownTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
              <PieChart className="h-4 w-4" />
            </div>
            {t('sections.revenueDistribution')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual bar */}
          <div className="space-y-3">
            <div className="flex h-8 rounded-lg overflow-hidden">
              <div
                className="bg-rose-500 dark:bg-rose-600 flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{ width: `${Math.min(variableCostPercentage, 100)}%` }}
              >
                {variableCostPercentage > 15 && formatPercent(variableCostPercentage)}
              </div>
              <div
                className="bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{ width: `${Math.max(100 - variableCostPercentage, 0)}%` }}
              >
                {contributionMargin > 15 && formatPercent(contributionMargin)}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-rose-500 dark:bg-rose-600" />
                <span className="text-muted-foreground">{t('variable_costs')}</span>
                <span className="font-medium tabular-nums">{formatPercent(variableCostPercentage)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500 dark:bg-emerald-600" />
                <span className="text-muted-foreground">{t('contribution_margin')}</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatPercent(contributionMargin)}
                </span>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('contribution_explanation', { margin: formatPercent(contributionMargin) })}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {variableCostSource === 'calculated'
                ? t('simulation.variable_cost_calculated_short', {
                    value: formatPercent(autoVariableCostPercentage),
                    sample: autoVariableCostSampleSize,
                    days: autoVariableCostPeriodDays,
                  })
                : t('simulation.variable_cost_fallback_short', {
                    value: formatPercent(autoVariableCostPercentage),
                  })}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
