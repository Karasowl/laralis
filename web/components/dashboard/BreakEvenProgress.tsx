'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Target, Calendar, TrendingUp, Lightbulb, Flame, Trophy, AlertCircle, ChevronDown, ChevronUp, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface BreakEvenProgressProps {
  monthlyTargetCents: number      // Break-even revenue (punto de equilibrio puro)
  monthlyGoalCents?: number | null // Meta mensual configurada (puede no existir)
  currentRevenueCents: number
  progressPercentage: number
  dailyTargetCents: number
  daysToBreakEven: number
  revenueGapCents: number
  actualDaysWorked: number
  totalWorkDaysInPeriod: number
  elapsedDays: number
  remainingWorkingDays: number
}

export function BreakEvenProgress({
  monthlyTargetCents,
  monthlyGoalCents,
  currentRevenueCents,
  progressPercentage,
  dailyTargetCents,
  daysToBreakEven,
  revenueGapCents,
  actualDaysWorked,
  totalWorkDaysInPeriod,
  elapsedDays,
  remainingWorkingDays
}: BreakEvenProgressProps) {
  const t = useTranslations('dashboardComponents.breakEvenProgress')

  // Calculate effective target: The GREATER between break-even and configured goal
  const effectiveTargetCents = useMemo(() => {
    return Math.max(
      monthlyTargetCents,
      monthlyGoalCents || monthlyTargetCents
    )
  }, [monthlyTargetCents, monthlyGoalCents])

  // Calculate percentages for each marker
  const breakEvenPercent = useMemo(() => {
    return effectiveTargetCents > 0
      ? (monthlyTargetCents / effectiveTargetCents) * 100
      : 0
  }, [monthlyTargetCents, effectiveTargetCents])

  const currentPercent = useMemo(() => {
    return Math.min(
      effectiveTargetCents > 0 ? (currentRevenueCents / effectiveTargetCents) * 100 : 0,
      100
    )
  }, [currentRevenueCents, effectiveTargetCents])

  const effectiveRevenueGapCents = Math.max(0, effectiveTargetCents - currentRevenueCents)

  // Determine status and messaging - SMART: Compare progress vs time elapsed
  const status = useMemo(() => {
    if (currentPercent >= 100) return 'success'

    // Calculate expected progress based on time elapsed
    const timeElapsedPercentage = totalWorkDaysInPeriod > 0
      ? (actualDaysWorked / totalWorkDaysInPeriod) * 100
      : 0

    // Calculate how far ahead/behind we are
    const progressDelta = currentPercent - timeElapsedPercentage

    // If we have minimal revenue, always show danger regardless of time
    if (currentRevenueCents < (effectiveTargetCents * 0.05)) {
      return 'danger'
    }

    // Status based on progress vs expected progress
    if (progressDelta >= 0) {
      // Ahead or on track
      return currentPercent >= 80 ? 'ontrack' : 'warning'
    } else if (progressDelta >= -15) {
      // Slightly behind (within 15%)
      return 'warning'
    } else {
      // Significantly behind
      return 'danger'
    }
  }, [currentPercent, actualDaysWorked, totalWorkDaysInPeriod, currentRevenueCents, effectiveTargetCents])

  const statusConfig = {
    success: {
      icon: Trophy,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200 dark:border-emerald-900',
      progressColor: 'bg-emerald-600'
    },
    ontrack: {
      icon: Flame,
      color: 'text-primary dark:text-primary/80',
      bgColor: 'bg-primary/10 dark:bg-primary/20 backdrop-blur-sm',
      borderColor: 'border-primary/30 dark:border-primary/40',
      progressColor: 'bg-primary'
    },
    warning: {
      icon: TrendingUp,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-900',
      progressColor: 'bg-amber-600'
    },
    danger: {
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10 dark:bg-destructive/20 backdrop-blur-sm',
      borderColor: 'border-destructive/30 dark:border-destructive/40',
      progressColor: 'bg-destructive'
    }
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  // Collapsible state - default collapsed for cleaner dashboard
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate suggestion (patients needed per day)
  const suggestedDailyRevenue = useMemo(() => {
    const remainingDays = Math.max(1, remainingWorkingDays)
    return Math.ceil(effectiveRevenueGapCents / remainingDays)
  }, [effectiveRevenueGapCents, remainingWorkingDays])

  // Check if we have a configured goal higher than break-even
  const hasConfiguredGoal = monthlyGoalCents && monthlyGoalCents > monthlyTargetCents
  const breakEvenRevenueGapCents = Math.max(0, monthlyTargetCents - currentRevenueCents)

  return (
    <Card className={cn('border-2 transition-all duration-200 hover:shadow-lg', config.borderColor)}>
      {/* Ultra-compact header */}
      <div className="px-4 py-3">
        {/* Row 1: Title + Badges + Expand Button - all inline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-semibold">{t('title')}</span>
            <Badge variant="outline" className="hidden sm:flex text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
              <Calendar className="h-2.5 w-2.5 mr-0.5" />
              {t('currentMonthOnly')}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={cn(config.bgColor, config.color, 'border text-[10px] px-1.5 py-0', config.borderColor, 'cursor-help')}>
                    <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                    {t(`status.${status}`)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{t(`status_tooltip.${status}`)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Row 2: Progress bar inline (when collapsed) */}
        {!isExpanded && (
          <div className="flex items-center gap-3 mt-2">
            <span className="font-bold text-lg tabular-nums w-12">{currentPercent.toFixed(0)}%</span>
            <div className="flex-1 relative">
              <Progress value={currentPercent} className="h-2" />
              {/* Break-even marker (only if there's a higher goal) */}
              {hasConfiguredGoal && breakEvenRevenueGapCents > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                  style={{ left: `${breakEvenPercent}%` }}
                  title={t('breakEvenMarker')}
                />
              )}
            </div>
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatCurrency(currentRevenueCents)} / {formatCurrency(effectiveTargetCents)}
            </span>
          </div>
        )}
      </div>

      {/* Collapsible content */}
      {isExpanded && (
      <CardContent className="space-y-6 animate-in fade-in-0 slide-in-from-top-2 duration-200">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          {/* Labels above progress bar on mobile for better readability */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('progress')}</span>
            <span className="font-bold text-lg">
              {currentPercent.toFixed(1)}%
            </span>
          </div>

          {/* Mobile: Labels above progress bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
            <span>{formatCurrency(currentRevenueCents)}</span>
            <span>{formatCurrency(effectiveTargetCents)}</span>
          </div>

          <div className="relative">
            <Progress
              value={currentPercent}
              className="h-3"
            />
            {/* Custom colored fill */}
            <div
              className={cn(
                "absolute top-0 left-0 h-3 rounded-full transition-all duration-500",
                config.progressColor
              )}
              style={{ width: `${currentPercent}%` }}
            />
            {/* Break-even marker (only if there's a higher configured goal) */}
            {hasConfiguredGoal && breakEvenRevenueGapCents > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                style={{ left: `${breakEvenPercent}%` }}
                title={t('breakEvenMarker')}
              />
            )}
          </div>

          {/* Desktop: Labels below progress bar */}
          <div className="hidden sm:flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(currentRevenueCents)}</span>
            <span>{formatCurrency(effectiveTargetCents)}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Current Revenue */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('current')}
            </div>
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(currentRevenueCents)}
            </div>
          </div>

          {/* Days Worked */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {t('daysWorked')}
            </div>
            <div className="text-xl font-bold text-foreground">
              {actualDaysWorked} / {totalWorkDaysInPeriod}
            </div>
          </div>

          {/* Break-Even Gap (only show if not reached and there's a higher goal) */}
          {hasConfiguredGoal && breakEvenRevenueGapCents > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Target className="h-3.5 w-3.5" />
                {t('toBreakEven')}
              </div>
              <div className="text-xl font-bold text-amber-600">
                {formatCurrency(breakEvenRevenueGapCents)}
              </div>
            </div>
          )}

          {/* Goal Gap */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              {t('toGoal')}
            </div>
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(effectiveRevenueGapCents)}
            </div>
          </div>
        </div>

        {/* Projection Message */}
        {currentPercent < 100 && currentRevenueCents > 0 && (
          <div className={cn('rounded-lg p-4 space-y-2', config.bgColor)}>
            <div className="flex items-start gap-2">
              <TrendingUp className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
              <div className="space-y-1">
                <p className={cn('text-sm font-medium', config.color)}>
                  {t('projection', {
                    days: daysToBreakEven,
                    remaining: remainingWorkingDays
                  })}
                </p>
                {daysToBreakEven > remainingWorkingDays && (
                  <p className="text-xs text-muted-foreground">
                    {t('atRisk')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No Revenue Yet Message */}
        {currentPercent < 100 && currentRevenueCents === 0 && (
          <div className={cn('rounded-lg p-4', config.bgColor)}>
            <div className="flex items-start gap-2">
              <AlertCircle className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
              <div>
                <p className={cn('text-sm font-medium', config.color)}>
                  {t('noRevenueYet')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('noRevenueHelp', { remaining: remainingWorkingDays })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {currentPercent >= 100 && (
          <div className={cn('rounded-lg p-4', config.bgColor)}>
            <div className="flex items-start gap-2">
              <Trophy className={cn('h-5 w-5 flex-shrink-0', config.color)} />
              <div>
                <p className={cn('text-sm font-semibold', config.color)}>
                  {t('congratulations')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('goalReached', {
                    excess: formatCurrency(currentRevenueCents - effectiveTargetCents)
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Suggestion */}
        {currentPercent < 100 && effectiveRevenueGapCents > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">
                  {t('suggestion.title')}
                </p>
                <p className="text-muted-foreground">
                  {t('suggestion.message', {
                    daily: formatCurrency(suggestedDailyRevenue),
                    remainingDays: Math.max(1, remainingWorkingDays)
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  )
}
