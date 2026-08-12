'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { Users, Repeat, UserPlus } from 'lucide-react'
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
          <Badge variant="outline" className="text-muted-foreground">
            {t('period_metric')}
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
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">{t('repeat_rate_explanation')}</p>
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
                <p className="text-sm">{t('acquisition_period_explanation')}</p>
              </div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}

// Missing import
import { DollarSign, Lightbulb } from 'lucide-react'
