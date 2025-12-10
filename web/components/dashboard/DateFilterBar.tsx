'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DatePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
export type Granularity = 'day' | 'week' | 'month'
export type ComparisonPeriod = 'none' | 'previous' | 'last-year'

interface DateRange {
  from: string
  to: string
}

interface DateFilterBarProps {
  period: DatePeriod
  granularity: Granularity
  comparison: ComparisonPeriod
  customRange?: DateRange
  onPeriodChange: (period: DatePeriod) => void
  onGranularityChange: (granularity: Granularity) => void
  onComparisonChange: (comparison: ComparisonPeriod) => void
  onCustomRangeChange: (range: DateRange) => void
  className?: string
}

export function DateFilterBar({
  period,
  granularity,
  comparison,
  customRange,
  onPeriodChange,
  onGranularityChange,
  onComparisonChange,
  onCustomRangeChange,
  className
}: DateFilterBarProps) {
  const t = useTranslations('dashboardComponents.dateFilter')
  const [showCustomInputs, setShowCustomInputs] = useState(false)

  const quickPeriods: { value: DatePeriod; label: string }[] = useMemo(() => [
    { value: 'today', label: t('periods.today') },
    { value: 'week', label: t('periods.week') },
    { value: 'month', label: t('periods.month') },
    { value: 'quarter', label: t('periods.quarter') },
    { value: 'year', label: t('periods.year') },
    { value: 'custom', label: t('periods.custom') },
  ], [t])

  const handlePeriodClick = (newPeriod: DatePeriod) => {
    onPeriodChange(newPeriod)
    setShowCustomInputs(newPeriod === 'custom')
  }

  const handleCustomFromChange = (value: string) => {
    onCustomRangeChange({
      from: value,
      to: customRange?.to || value
    })
  }

  const handleCustomToChange = (value: string) => {
    onCustomRangeChange({
      from: customRange?.from || value,
      to: value
    })
  }

  return (
    <Card className={cn('border-2 border-muted', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Quick Period Buttons */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Calendar className="h-3.5 w-3.5" />
            {t('selectPeriod')}
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {quickPeriods.map((item) => (
              <Button
                key={item.value}
                variant={period === item.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodClick(item.value)}
                className={cn(
                  'transition-all',
                  period === item.value && 'shadow-md'
                )}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {(period === 'custom' || showCustomInputs) && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('from')}
              </label>
              <input
                type="date"
                className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customRange?.from || ''}
                onChange={(e) => handleCustomFromChange(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('to')}
              </label>
              <input
                type="date"
                className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customRange?.to || ''}
                onChange={(e) => handleCustomToChange(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Granularity and Comparison */}
        <div className="grid grid-cols-2 gap-3">
          {/* Granularity */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              {t('breakdown')}
            </label>
            <Select value={granularity} onValueChange={onGranularityChange}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t('granularity.day')}</SelectItem>
                <SelectItem value="week">{t('granularity.week')}</SelectItem>
                <SelectItem value="month">{t('granularity.month')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comparison */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              {t('compareWith')}
            </label>
            <Select value={comparison} onValueChange={onComparisonChange}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('comparison.none')}</SelectItem>
                <SelectItem value="previous">{t('comparison.previous')}</SelectItem>
                <SelectItem value="last-year">{t('comparison.lastYear')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        {period !== 'custom' && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
            {t('summary', {
              period: t(`periods.${period}`),
              granularity: t(`granularity.${granularity}`),
              comparison: comparison !== 'none' ? t(`comparison.${comparison}`) : t('comparison.none')
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
