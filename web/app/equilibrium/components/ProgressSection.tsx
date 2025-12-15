'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import { AlertTriangle, CheckCircle, TrendingUp, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ProgressSectionProps {
  currentRevenueCents: number
  monthlyTargetCents: number
  revenueGapCents: number
  progressPercentage: number
  daysToBreakEven: number
  remainingWorkingDays: number
}

export function ProgressSection({
  currentRevenueCents,
  monthlyTargetCents,
  revenueGapCents,
  progressPercentage,
  daysToBreakEven,
  remainingWorkingDays,
}: ProgressSectionProps) {
  const t = useTranslations('equilibrium')

  const formatPercent = (value: number) =>
    `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`

  const isGoalReached = revenueGapCents <= 0
  const isAtRisk = daysToBreakEven > remainingWorkingDays

  const getStatusBadge = () => {
    if (isGoalReached) {
      return (
        <Badge variant="success" className="text-xs">
          {t('summary.goalBadge')}
        </Badge>
      )
    }
    if (isAtRisk) {
      return (
        <Badge variant="destructive" className="text-xs">
          {t('summary.gapBadgeAtRisk', { days: daysToBreakEven, remaining: remainingWorkingDays })}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs">
        {t('summary.gapBadge', { days: daysToBreakEven })}
      </Badge>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{t('sections.currentProgress')}</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{t('sections.currentProgressTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('monthly_progress')}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                {t('current_vs_target')}
                {getStatusBadge()}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">
                {formatPercent(progressPercentage)}
              </div>
              <p className="text-xs text-muted-foreground">{t('completed')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="relative">
              <Progress
                value={Math.min(progressPercentage, 100)}
                className="h-4"
              />
              {progressPercentage > 100 && (
                <div
                  className="absolute top-0 right-0 h-4 bg-emerald-600 rounded-r-full animate-pulse"
                  style={{ width: `${Math.min((progressPercentage - 100) / 2, 10)}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-muted-foreground">{t('current_revenue')}: </span>
                <span className="font-medium tabular-nums">{formatCurrency(currentRevenueCents)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('target')}: </span>
                <span className="font-medium tabular-nums">{formatCurrency(monthlyTargetCents)}</span>
              </div>
            </div>
          </div>

          {/* Gap warning */}
          {!isGoalReached && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-sm">{t('revenue_gap')}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('amount_needed')}</p>
                  <p className="text-lg font-semibold tabular-nums">{formatCurrency(revenueGapCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('days_to_achieve')}</p>
                  <p className="text-lg font-semibold">{t('summary.daysLabel', { days: daysToBreakEven })}</p>
                </div>
              </div>

              {/* At risk warning */}
              {isAtRisk && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">
                    {t('summary.atRiskWarning', { days: daysToBreakEven, remaining: remainingWorkingDays })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Success message */}
          {isGoalReached && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                {t('summary.goalMessage')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
