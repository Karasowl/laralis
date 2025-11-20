'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calendar,
  RefreshCw,
  TrendingUp,
  Check,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkingDaysConfig } from '@/lib/calc/dates'

interface WorkingDaySelectorProps {
  value: WorkingDaysConfig
  onChange: (config: WorkingDaysConfig) => void
  clinicId?: string
  onRefreshPattern?: () => Promise<void>
  loading?: boolean
}

const DAYS_ORDER = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const

export function WorkingDaysSelector({
  value,
  onChange,
  clinicId,
  onRefreshPattern,
  loading = false
}: WorkingDaySelectorProps) {
  const t = useTranslations('time.workingDays')
  const [refreshing, setRefreshing] = useState(false)

  const hasDetectedPattern = !!(value.detected && value.detected.confidence >= 60)
  const isUsingHistorical = !!(value.useHistorical && hasDetectedPattern)

  const handleToggleDay = (day: keyof WorkingDaysConfig['manual']) => {
    onChange({
      ...value,
      manual: {
        ...value.manual,
        [day]: !value.manual[day]
      }
    })
  }

  const handleToggleUseHistorical = (checked: boolean) => {
    onChange({
      ...value,
      useHistorical: checked
    })
  }

  const handleRefresh = async () => {
    if (!onRefreshPattern) return
    setRefreshing(true)
    try {
      await onRefreshPattern()
    } finally {
      setRefreshing(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30'
    if (confidence >= 60) return 'text-primary border-primary/30 bg-primary/10 dark:bg-primary/20/30'
    return 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>

        {onRefreshPattern && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-2', refreshing && 'animate-spin')} />
            {t('refresh')}
          </Button>
        )}
      </div>

      {/* Historical Pattern Detection */}
      {hasDetectedPattern && (
        <div className="border-2 border-dashed rounded-lg p-4 space-y-4">
          {/* Pattern Info */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {t('detected.title')}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    getConfidenceColor(value.detected!.confidence)
                  )}
                >
                  {t('detected.confidence')}: {value.detected!.confidence}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('detected.description', {
                  sampleSize: value.detected!.sampleSize
                })}
              </p>
            </div>
          </div>

          {/* Pattern Frequency Visualization */}
          <div className="grid grid-cols-7 gap-2">
            {DAYS_ORDER.map(day => {
              const frequency = value.detected!.pattern[day]
              const percentage = Math.round(frequency * 100)

              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div className="text-xs font-medium text-foreground">
                    {t(`days.${day}.short`)}
                  </div>
                  <div className="w-full h-16 bg-muted rounded-md overflow-hidden relative">
                    <div
                      className={cn(
                        'absolute bottom-0 left-0 right-0 transition-all duration-300',
                        frequency >= 0.5 ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                      style={{ height: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {percentage}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Toggle to use historical */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground cursor-pointer">
                {t('detected.useHistorical')}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('detected.useHistoricalHelp')}
              </p>
            </div>
            <Switch
              checked={value.useHistorical}
              onCheckedChange={handleToggleUseHistorical}
            />
          </div>
        </div>
      )}

      {/* Manual Configuration */}
      <div className={cn(
        'space-y-3',
        isUsingHistorical && 'opacity-60 pointer-events-none'
      )}>
        <div>
          <label className="text-sm font-medium text-foreground">
            {isUsingHistorical ? t('manual.titleDisabled') : t('manual.title')}
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            {isUsingHistorical ? t('manual.subtitleDisabled') : t('manual.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {DAYS_ORDER.map(day => {
            const isSelected = value.manual[day]

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleToggleDay(day)}
                disabled={isUsingHistorical}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200',
                  'hover:border-primary/50 hover:bg-primary/5',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-muted bg-background',
                  isUsingHistorical && 'cursor-not-allowed'
                )}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                )}>
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </div>
                <div className="text-xs font-medium text-center">
                  {t(`days.${day}.short`)}
                </div>
                <div className="text-[10px] text-muted-foreground text-center">
                  {t(`days.${day}.full`)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <p className="text-xs text-muted-foreground">
          {isUsingHistorical
            ? t('summary.usingHistorical')
            : t('summary.usingManual', {
                count: Object.values(value.manual).filter(Boolean).length
              })
          }
        </p>
      </div>
    </div>
  )
}
