'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Target, Calendar, TrendingUp, Lightbulb, Flame, Trophy, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface BreakEvenProgressProps {
  monthlyTargetCents: number
  currentRevenueCents: number
  progressPercentage: number
  dailyTargetCents: number
  daysToBreakEven: number
  revenueGapCents: number
  workDays?: number
}

export function BreakEvenProgress({
  monthlyTargetCents,
  currentRevenueCents,
  progressPercentage,
  dailyTargetCents,
  daysToBreakEven,
  revenueGapCents,
  workDays = 20
}: BreakEvenProgressProps) {
  const t = useTranslations('dashboardComponents.breakEvenProgress')

  // Calculate days worked (approximate based on progress)
  const daysWorked = useMemo(() => {
    if (dailyTargetCents <= 0) return 0
    return Math.round(currentRevenueCents / dailyTargetCents)
  }, [currentRevenueCents, dailyTargetCents])

  // Determine status and messaging
  const status = useMemo(() => {
    if (progressPercentage >= 100) return 'success'
    if (progressPercentage >= 80) return 'ontrack'
    if (progressPercentage >= 50) return 'warning'
    return 'danger'
  }, [progressPercentage])

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
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-900',
      progressColor: 'bg-blue-600'
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
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-900',
      progressColor: 'bg-red-600'
    }
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  // Calculate suggestion (patients needed per day)
  const suggestedDailyRevenue = useMemo(() => {
    const remainingDays = Math.max(1, workDays - daysWorked)
    return Math.ceil(revenueGapCents / remainingDays)
  }, [revenueGapCents, workDays, daysWorked])

  return (
    <Card className={cn('border-2', config.borderColor)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
          <Badge className={cn(config.bgColor, config.color, 'border', config.borderColor)}>
            <StatusIcon className="h-3.5 w-3.5 mr-1" />
            {t(`status.${status}`)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('progress')}</span>
            <span className="font-bold text-lg">
              {Math.min(100, progressPercentage).toFixed(1)}%
            </span>
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

          <div className="flex items-center justify-between text-xs text-muted-foreground">
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
              {daysWorked} / {workDays}
            </div>
          </div>
        </div>

        {/* Projection Message */}
        {progressPercentage < 100 && (
          <div className={cn('rounded-lg p-4 space-y-2', config.bgColor)}>
            <div className="flex items-start gap-2">
              <TrendingUp className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
              <div className="space-y-1">
                <p className={cn('text-sm font-medium', config.color)}>
                  {t('projection', {
                    days: daysToBreakEven,
                    remaining: workDays - daysWorked
                  })}
                </p>
                {daysToBreakEven > (workDays - daysWorked) && (
                  <p className="text-xs text-muted-foreground">
                    {t('atRisk')}
                  </p>
                )}
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
              <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">
                  {t('suggestion.title')}
                </p>
                <p className="text-muted-foreground">
                  {t('suggestion.message', {
                    daily: formatCurrency(suggestedDailyRevenue),
                    remainingDays: Math.max(1, workDays - daysWorked)
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
