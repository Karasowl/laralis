'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown, LucideIcon } from 'lucide-react'

export interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  // When true, a decrease is treated as positive (e.g., lower expenses).
  lowerIsBetter?: boolean
  icon: LucideIcon
  color?: string
  subtitle?: string
  // Raw numeric value in cents for intelligent change display
  valueInCents?: number
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  lowerIsBetter = false,
  icon: Icon,
  color = 'text-primary',
  subtitle,
  valueInCents
}: MetricCardProps) {
  const t = useTranslations('dashboard')

  // SMART: Don't show misleading percentages for insignificant values
  // Only show percentage change if the absolute value is meaningful
  const MINIMUM_SIGNIFICANT_VALUE_CENTS = 10000 // $100 MXN

  const shouldShowChange = () => {
    if (change === undefined) return false
    // If we have the raw value, check if it's significant
    if (valueInCents !== undefined) {
      return valueInCents >= MINIMUM_SIGNIFICANT_VALUE_CENTS
    }
    // If no raw value provided, show it (backward compatible)
    return true
  }

  const getChangeColor = () => {
    if (changeType === 'neutral') return 'text-muted-foreground'

    const positiveColor = 'text-emerald-600 dark:text-emerald-500'
    const negativeColor = 'text-destructive'
    const isIncrease = changeType === 'increase'

    if (lowerIsBetter) {
      return isIncrease ? negativeColor : positiveColor
    }

    return isIncrease ? positiveColor : negativeColor
  }

  const getChangeIcon = () => {
    if (changeType === 'increase') return ArrowUp
    if (changeType === 'decrease') return ArrowDown
    return null
  }

  const ChangeIcon = getChangeIcon()

  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-primary/10 dark:bg-primary/20 backdrop-blur-sm`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {shouldShowChange() && (
          <div className={`flex items-center mt-2 text-xs ${getChangeColor()}`}>
            {ChangeIcon && <ChangeIcon className="h-3 w-3 mr-1" />}
            <span>{Math.abs(change!)}%</span>
            <span className="text-muted-foreground ml-1">{t('vs_previous_month')}</span>
          </div>
        )}
        {change !== undefined && !shouldShowChange() && valueInCents !== undefined && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('insufficient_data')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
