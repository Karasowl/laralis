'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { Users, Repeat, UserPlus, TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface PatientInsights {
  lifetime_value: number
  retention_rate: number
  acquisition_rate: number
}

interface PatientAnalysisProps {
  insights: PatientInsights
  loading?: boolean
}

export function PatientAnalysis({ insights, loading }: PatientAnalysisProps) {
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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const retentionPercentage = insights.retention_rate * 100
  const churnRate = (1 - insights.retention_rate) * 100

  // Determine retention status
  const retentionStatus = retentionPercentage >= 70
    ? { label: t('excellent'), color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20' }
    : retentionPercentage >= 50
    ? { label: t('good'), color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20' }
    : { label: t('needs_improvement'), color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/20' }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('patient_analysis')}
            </CardTitle>
            <CardDescription>{t('patient_analysis_description')}</CardDescription>
          </div>
          <Badge variant="outline" className={retentionStatus.color}>
            {retentionStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Lifetime Value */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('lifetime_value')}</p>
                <p className="text-xs text-muted-foreground">{t('average_per_patient')}</p>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{formatCurrency(insights.lifetime_value)}</p>
          </div>
          <div className="pl-10">
            <p className="text-xs text-muted-foreground">
              {t('ltv_insight', { value: formatCurrency(insights.lifetime_value) })}
            </p>
          </div>
        </div>

        {/* Retention Rate */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 flex-shrink-0">
                <Repeat className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('retention_rate')}</p>
                <p className="text-xs text-muted-foreground">{t('patients_returning')}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl sm:text-2xl font-bold">{retentionPercentage.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">{t('churn_rate')}: {churnRate.toFixed(0)}%</p>
            </div>
          </div>
          <div className="pl-10 space-y-2">
            <Progress value={retentionPercentage} className="h-2" />
            <div className={`p-3 rounded-lg ${retentionStatus.bgColor}`}>
              <p className="text-sm">
                {retentionPercentage >= 70 ? (
                  <>
                    <span className="font-medium">{t('retention_excellent')}</span>
                    {' '}{t('retention_excellent_desc')}
                  </>
                ) : retentionPercentage >= 50 ? (
                  <>
                    <span className="font-medium">{t('retention_good')}</span>
                    {' '}{t('retention_good_desc')}
                  </>
                ) : (
                  <>
                    <span className="font-medium">{t('retention_low')}</span>
                    {' '}{t('retention_low_desc')}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Acquisition Rate */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 flex-shrink-0">
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('acquisition_rate')}</p>
                <p className="text-xs text-muted-foreground">{t('new_patients_monthly')}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl sm:text-2xl font-bold">{insights.acquisition_rate}</p>
              <p className="text-xs text-muted-foreground">{t('per_month')}</p>
            </div>
          </div>
          <div className="pl-10">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm">
                  {insights.acquisition_rate > 10 ? (
                    <>
                      <span className="font-medium">{t('acquisition_strong')}</span>
                      {' '}{t('acquisition_strong_desc')}
                    </>
                  ) : insights.acquisition_rate > 5 ? (
                    <>
                      <span className="font-medium">{t('acquisition_moderate')}</span>
                      {' '}{t('acquisition_moderate_desc')}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{t('acquisition_low')}</span>
                      {' '}{t('acquisition_low_desc')}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Summary */}
        {(retentionPercentage < 70 || insights.acquisition_rate < 10) && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">{t('recommended_actions')}</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {retentionPercentage < 70 && (
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('action_retention')}</span>
                </li>
              )}
              {insights.acquisition_rate < 10 && (
                <li className="flex items-start gap-2">
                  <UserPlus className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t('action_acquisition')}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Missing import
import { DollarSign, Lightbulb } from 'lucide-react'
