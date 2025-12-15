'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { TrendingUp, Calculator, Info, Shield } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MonthlyGoalSectionProps {
  monthlyTargetCents: number
  dailyTargetCents: number
  workDays: number
  safetyMarginPercentage: number
  safetyMarginCents: number
  manualMonthlyTargetCents: number
  customSafetyMarginPercentage: number
}

export function MonthlyGoalSection({
  monthlyTargetCents,
  dailyTargetCents,
  workDays,
  safetyMarginPercentage,
  safetyMarginCents,
  manualMonthlyTargetCents,
  customSafetyMarginPercentage,
}: MonthlyGoalSectionProps) {
  const t = useTranslations('equilibrium')

  const formatPercent = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{t('sections.monthlyGoal')}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{t('sections.monthlyGoalTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Monthly Target Card */}
        <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('monthly_target')}</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatCurrency(monthlyTargetCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('with_safety_margin')}
            </p>
          </CardContent>
        </Card>

        {/* Daily Target Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('daily_target')}</CardTitle>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Calculator className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(dailyTargetCents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {workDays} {t('work_days')}
            </p>
          </CardContent>
        </Card>

        {/* Safety Margin Card */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('safety_margin')}</CardTitle>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Shield className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {formatCurrency(safetyMarginCents)}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                ({formatPercent(safetyMarginPercentage)})
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {manualMonthlyTargetCents > 0
                ? t('simulation.manual_target_active_hint', {
                    amount: formatCurrency(manualMonthlyTargetCents),
                  })
                : t('simulation.safety_margin_custom_hint', {
                    percentage: formatPercent(customSafetyMarginPercentage),
                  })}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
