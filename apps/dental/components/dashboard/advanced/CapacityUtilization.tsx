'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface OperationalMetrics {
  capacity_utilization: number
  average_minutes_per_day: number
}

interface CapacityUtilizationProps {
  metrics: OperationalMetrics
  loading?: boolean
}

export function CapacityUtilization({ metrics, loading }: CapacityUtilizationProps) {
  const t = useTranslations('dashboard.advanced')
  const tCommon = useTranslations('common')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-40 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const utilizationPercentage = metrics.capacity_utilization * 100
  const theoreticalCapacity = 8 * 60 // 8 hours = 480 minutes
  const remainingMinutes = theoreticalCapacity - metrics.average_minutes_per_day
  const remainingHours = Math.floor(remainingMinutes / 60)
  const remainingMins = Math.round(remainingMinutes % 60)

  // Calculate potential additional patients
  const avgMinutesPerPatient = 60 // Assumption: 60 min per patient
  const potentialAdditionalPatients = Math.floor(remainingMinutes / avgMinutesPerPatient)

  // Determine status
  const status = utilizationPercentage >= 85
    ? { label: t('high_utilization'), color: 'text-emerald-600', variant: 'default' as const }
    : utilizationPercentage >= 60
    ? { label: t('optimal'), color: 'text-blue-600', variant: 'secondary' as const }
    : { label: t('low_utilization'), color: 'text-amber-600', variant: 'outline' as const }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('capacity_utilization_title')}
            </CardTitle>
            <CardDescription>{t('capacity_utilization_description')}</CardDescription>
          </div>
          <Badge variant={status.variant} className={status.color}>
            {utilizationPercentage.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('hours_worked')}</span>
            <span className="font-medium">
              {Math.floor(metrics.average_minutes_per_day / 60)}h {Math.round(metrics.average_minutes_per_day % 60)}m
              {' '} / {' '}
              {theoreticalCapacity / 60}h {t('available')}
            </span>
          </div>
          <Progress value={utilizationPercentage} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('utilized')}</span>
            <span>{t('available_capacity')}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{t('avg_minutes_per_day')}</p>
            <p className="text-xl sm:text-2xl font-bold">{Math.round(metrics.average_minutes_per_day)}</p>
            <p className="text-xs text-muted-foreground">{t('minutes')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{t('remaining_capacity')}</p>
            <p className="text-xl sm:text-2xl font-bold">{remainingHours}h {remainingMins}m</p>
            <p className="text-xs text-muted-foreground">{t('per_day')}</p>
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-3 pt-4 border-t">
          <p className="text-sm font-medium">{t('insights')}</p>

          {utilizationPercentage >= 85 ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-emerald-900 dark:text-emerald-100">
                  <span className="font-medium">{t('excellent_utilization')}</span>
                  {' '}{t('excellent_utilization_desc')}
                </p>
              </div>
            </div>
          ) : utilizationPercentage >= 60 ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <span className="font-medium">{t('good_balance')}</span>
                  {' '}{t('good_balance_desc', { patients: potentialAdditionalPatients })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <span className="font-medium">{t('low_capacity_alert')}</span>
                  {' '}{t('low_capacity_desc', { patients: potentialAdditionalPatients })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recommendation */}
        {utilizationPercentage < 85 && potentialAdditionalPatients > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">{t('recommendation')}</p>
            <p className="text-sm text-muted-foreground">
              {t('capacity_recommendation', {
                patients: potentialAdditionalPatients,
                hours: remainingHours
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
