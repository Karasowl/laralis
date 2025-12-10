'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  monthlyTargetCents: number
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

  // Determine status and messaging - SMART: Compare progress vs time elapsed
  const status = useMemo(() => {
    if (progressPercentage >= 100) return 'success'

    // Calculate expected progress based on time elapsed
    const timeElapsedPercentage = totalWorkDaysInPeriod > 0
      ? (actualDaysWorked / totalWorkDaysInPeriod) * 100
      : 0

    // Calculate how far ahead/behind we are
    const progressDelta = progressPercentage - timeElapsedPercentage

    // If we have minimal revenue, always show danger regardless of time
    if (currentRevenueCents < (monthlyTargetCents * 0.05)) {
      return 'danger'
    }

    // Status based on progress vs expected progress
    if (progressDelta >= 0) {
      // Ahead or on track
      return progressPercentage >= 80 ? 'ontrack' : 'warning'
    } else if (progressDelta >= -15) {
      // Slightly behind (within 15%)
      return 'warning'
    } else {
      // Significantly behind
      return 'danger'
    }
  }, [progressPercentage, actualDaysWorked, totalWorkDaysInPeriod, currentRevenueCents, monthlyTargetCents])

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
    return Math.ceil(revenueGapCents / remainingDays)
  }, [revenueGapCents, remainingWorkingDays])

  return (
    <Card className={cn('border-2 transition-all duration-200 hover:shadow-lg', config.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t('title')}
              <Badge variant="outline" className="ml-2 text-xs font-normal text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1" />
                {t('currentMonthOnly')}
              </Badge>
            </CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={cn(config.bgColor, config.color, 'border', config.borderColor, 'cursor-help')}>
                    <StatusIcon className="h-3.5 w-3.5 mr-1" />
                    {t(`status.${status}`)}
                    <Info className="h-3 w-3 ml-1 opacity-60" />
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
              className="h-8 w-8 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? t('collapse') : t('expand')}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Compact summary when collapsed */}
        {!isExpanded && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('progress')}:</span>
              <span className="font-bold">{Math.min(100, progressPercentage).toFixed(1)}%</span>
            </div>
            <div className="flex-1">
              <Progress value={Math.min(100, progressPercentage)} className="h-2" />
            </div>
            <span className="text-muted-foreground text-xs">
              {formatCurrency(currentRevenueCents)} / {formatCurrency(monthlyTargetCents)}
            </span>
          </div>
        )}
      </CardHeader>

      {/* Collapsible content */}
      {isExpanded && (
      <CardContent className="space-y-6 animate-in fade-in-0 slide-in-from-top-2 duration-200">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          {/* Labels above progress bar on mobile for better readability */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('progress')}</span>
            <span className="font-bold text-lg">
              {Math.min(100, progressPercentage).toFixed(1)}%
            </span>
          </div>

          {/* Mobile: Labels above progress bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
            <span>{formatCurrency(currentRevenueCents)}</span>
            <span>{formatCurrency(monthlyTargetCents)}</span>
          </div>

          <div className="relative">
            <Progress
              value={Math.min(100, progressPercentage)}
              className="h-3"
            />
            {/* Custom colored fill */}
            <div
              className={cn(
                "absolute top-0 left-0 h-3 rounded-full transition-all duration-500",
                config.progressColor
              )}
              style={{ width: `${Math.min(100, progressPercentage)}%` }}
            />
          </div>

          {/* Desktop: Labels below progress bar */}
          <div className="hidden sm:flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(currentRevenueCents)}</span>
            <span>{formatCurrency(monthlyTargetCents)}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Revenue Gap */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              {t('remaining')}
            </div>
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(Math.max(0, revenueGapCents))}
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
        </div>

        {/* Projection Message */}
        {progressPercentage < 100 && currentRevenueCents > 0 && (
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
        {progressPercentage < 100 && currentRevenueCents === 0 && (
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
        {progressPercentage >= 100 && (
          <div className={cn('rounded-lg p-4', config.bgColor)}>
            <div className="flex items-start gap-2">
              <Trophy className={cn('h-5 w-5 flex-shrink-0', config.color)} />
              <div>
                <p className={cn('text-sm font-semibold', config.color)}>
                  {t('congratulations')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('goalReached', {
                    excess: formatCurrency(currentRevenueCents - monthlyTargetCents)
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Suggestion */}
        {progressPercentage < 100 && revenueGapCents > 0 && (
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
