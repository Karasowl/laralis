'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Zap,
  Brain,
  Calendar,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
  AlertCircle,
  Lightbulb
} from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import type { BusinessInsights } from '@/lib/analytics'
import type { ReportsKpis } from '@/hooks/use-reports'
import { PatientAnalysis } from '@/components/dashboard/advanced/PatientAnalysis'
import { CapacityUtilization } from '@/components/dashboard/advanced/CapacityUtilization'

interface ReportsAdvancedProps {
  insights: BusinessInsights | null
  kpis: ReportsKpis | null
  loading: boolean
}

export function ReportsAdvanced({ insights, kpis, loading }: ReportsAdvancedProps) {
  const t = useTranslations('reports')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!insights || !kpis) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">{t('advanced.noData')}</p>
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <ArrowUpRight className="h-4 w-4 text-green-600" />
      case 'decreasing': return <ArrowDownRight className="h-4 w-4 text-destructive" />
      default: return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.8) return { label: t('advanced.confidence.high'), color: 'bg-green-500' }
    if (confidence >= 0.6) return { label: t('advanced.confidence.medium'), color: 'bg-yellow-500' }
    return { label: t('advanced.confidence.low'), color: 'bg-destructive/100' }
  }

  return (
    <div className="space-y-6">
      {/* Revenue Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            {t('advanced.revenuePredictions.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'next_month', label: t('advanced.revenuePredictions.nextMonth'), icon: Calendar },
              { key: 'next_quarter', label: t('advanced.revenuePredictions.nextQuarter'), icon: Target },
              { key: 'year_end', label: t('advanced.revenuePredictions.yearEnd'), icon: Zap }
            ].map(period => {
              const prediction = insights.revenue_predictions[period.key as keyof typeof insights.revenue_predictions]
              const Icon = period.icon
              const confidence = getConfidenceLevel(prediction.confidence)
              
              return (
                <div key={period.key} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{period.label}</span>
                    </div>
                    {getTrendIcon(prediction.trend)}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      {formatCurrency(prediction.predictedValue)}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={confidence.color + ' text-white'}>
                        {confidence.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {t('advanced.revenuePredictions.range')}: {formatCurrency(prediction.confidence_interval[0])} - {formatCurrency(prediction.confidence_interval[1])}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Service Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-600" />
              {t('advanced.services.mostProfitable')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.service_analysis.most_profitable.slice(0, 5).map((service, index) => (
                <div key={service.service_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-yellow-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium">{t('advanced.services.serviceId', { id: service.service_id })}</p>
                      <p className="text-xs text-muted-foreground">{service.frequency} {t('advanced.services.treatments')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{service.roi.toFixed(1)}% ROI</p>
                    <Progress value={Math.min(service.roi, 100)} className="w-16 h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              {t('advanced.services.growthOpportunities')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.service_analysis.growth_opportunities.slice(0, 5).map((opportunity, index) => (
                <div key={opportunity.service_id} className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t('advanced.services.serviceId', { id: opportunity.service_id })}</p>
                      <p className="text-xs text-muted-foreground">{t('advanced.services.highPotential')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">
                      {formatCurrency(opportunity.potential_revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('advanced.services.potential')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Analysis - New Component */}
      <div className="grid gap-4 md:grid-cols-2">
        <PatientAnalysis insights={insights.patient_insights} />
        <CapacityUtilization metrics={insights.operational_metrics} />
      </div>

      {/* Declining Services Alert */}
      {insights.service_analysis.declining_services.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {t('advanced.alerts.decliningServices')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.service_analysis.declining_services.map(service => (
                <div key={service.service_id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">{t('advanced.services.serviceId', { id: service.service_id })}</p>
                      <p className="text-xs text-muted-foreground">{t('advanced.alerts.requiresAttention')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">
                      -{(service.decline_rate * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">{t('advanced.alerts.monthlyDecline')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            {t('advanced.kpis.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <p className="text-sm text-primary font-medium">{t('advanced.kpis.avgTreatmentValue')}</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(kpis.avgTreatmentValue)}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <p className="text-sm text-green-600 font-medium">{t('advanced.kpis.avgMargin')}</p>
              <p className="text-xl font-bold text-green-700">{kpis.avgMargin.toFixed(1)}%</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">{t('advanced.kpis.patientsPerDay')}</p>
              <p className="text-xl font-bold text-purple-700">{kpis.avgPatientsPerDay.toFixed(1)}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">{t('advanced.kpis.treatmentsLast30')}</p>
              <p className="text-xl font-bold text-orange-700">{kpis.treatmentCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
