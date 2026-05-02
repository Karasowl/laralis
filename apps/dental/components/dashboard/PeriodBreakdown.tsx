'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Granularity } from './DateFilterBar'

interface PeriodData {
  label: string
  value: number
  date: string
}

interface ComparisonData {
  current: PeriodData[]
  previous?: PeriodData[]
}

interface PeriodBreakdownProps {
  data: ComparisonData
  granularity: Granularity
  title?: string
  description?: string
  valueFormatter?: (value: number) => string
  showComparison?: boolean
}

export function PeriodBreakdown({
  data,
  granularity,
  title,
  description,
  valueFormatter = formatCurrency,
  showComparison = false
}: PeriodBreakdownProps) {
  const t = useTranslations('dashboardComponents.breakdown')

  const { maxValue, totalCurrent, totalPrevious, percentageChange } = useMemo(() => {
    const currentValues = data.current.map(d => d.value)
    const previousValues = data.previous?.map(d => d.value) || []

    const max = Math.max(...currentValues, ...previousValues)
    const sumCurrent = currentValues.reduce((a, b) => a + b, 0)
    const sumPrevious = previousValues.reduce((a, b) => a + b, 0)

    const change = sumPrevious > 0
      ? ((sumCurrent - sumPrevious) / sumPrevious) * 100
      : 0

    return {
      maxValue: max,
      totalCurrent: sumCurrent,
      totalPrevious: sumPrevious,
      percentageChange: change
    }
  }, [data])

  const getTrendIcon = (change: number) => {
    if (change === 0) return Minus
    return change > 0 ? TrendingUp : TrendingDown
  }

  const getTrendColor = (change: number) => {
    if (change === 0) return 'text-muted-foreground'
    return change > 0 ? 'text-emerald-600' : 'text-red-600'
  }

  const getBarHeight = (value: number) => {
    if (maxValue === 0) return '0%'
    return `${(value / maxValue) * 100}%`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {title || t('title', { granularity: t(`granularity.${granularity}`) })}
            </CardTitle>
            <CardDescription>
              {description || t('description')}
            </CardDescription>
          </div>
          {showComparison && totalPrevious > 0 && (
            <Badge
              variant="outline"
              className={cn('gap-1', getTrendColor(percentageChange))}
            >
              {getTrendIcon(percentageChange)({ className: 'h-3.5 w-3.5' })}
              {Math.abs(percentageChange).toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('currentPeriod')}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {valueFormatter(totalCurrent)}
            </p>
          </div>
          {showComparison && totalPrevious > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {t('previousPeriod')}
              </p>
              <p className="text-2xl font-bold text-muted-foreground">
                {valueFormatter(totalPrevious)}
              </p>
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="space-y-3">
          {data.current.map((item, index) => {
            const previousValue = data.previous?.[index]?.value || 0
            const itemChange = previousValue > 0
              ? ((item.value - previousValue) / previousValue) * 100
              : 0

            return (
              <div key={item.date} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{valueFormatter(item.value)}</span>
                    {showComparison && previousValue > 0 && itemChange !== 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'gap-1 text-xs h-5',
                          getTrendColor(itemChange)
                        )}
                      >
                        {itemChange > 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(itemChange).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                  {/* Previous period bar (ghost) */}
                  {showComparison && previousValue > 0 && (
                    <div
                      className="absolute top-0 left-0 h-full bg-muted-foreground/20 transition-all duration-300"
                      style={{ width: getBarHeight(previousValue) }}
                    />
                  )}

                  {/* Current period bar */}
                  <div
                    className={cn(
                      'absolute top-0 left-0 h-full transition-all duration-500',
                      item.value > previousValue
                        ? 'bg-emerald-500'
                        : item.value < previousValue && previousValue > 0
                        ? 'bg-amber-500'
                        : 'bg-primary'
                    )}
                    style={{ width: getBarHeight(item.value) }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend for comparison */}
        {showComparison && totalPrevious > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span>{t('legend.current')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/20" />
              <span>{t('legend.previous')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
