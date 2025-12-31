'use client'

import { useTranslations } from 'next-intl'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface ComparisonIndicatorProps {
  change: number | null
  trend: 'up' | 'down' | null
  comparisonType: 'previous' | 'last-year'
  lowerIsBetter?: boolean
  className?: string
}

export function ComparisonIndicator({
  change,
  trend,
  comparisonType,
  lowerIsBetter = false,
  className = ''
}: ComparisonIndicatorProps) {
  const t = useTranslations('dashboard')

  if (change === null || trend === null) return null

  const isPositive = lowerIsBetter ? trend === 'down' : trend === 'up'
  const colorClass = isPositive
    ? 'text-emerald-600 dark:text-emerald-500'
    : 'text-red-600 dark:text-red-500'

  const comparisonLabel = comparisonType === 'last-year'
    ? t('vs_previous_year')
    : t('vs_previous_period')

  return (
    <div className={`flex items-center gap-1 text-sm ${colorClass} ${className}`}>
      {trend === 'up' ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span className="font-medium">
        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
      <span className="text-muted-foreground text-xs">
        {comparisonLabel}
      </span>
    </div>
  )
}
