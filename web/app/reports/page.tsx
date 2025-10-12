'use client'

import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  FileText,
  Package,
  Brain,
  BarChart3,
  Megaphone,
  Calendar,
  Target,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  ArrowUpCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useReports } from '@/hooks/use-reports'
import { ReportsAdvanced } from './ReportsAdvanced'
import { ReportsMarketing } from './ReportsMarketing'

type PredictionKey = 'next_month' | 'next_quarter' | 'year_end'

const confidenceToneClass: Record<'success' | 'info' | 'warning', string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
}

const formatServiceId = (id: string) => (id.length > 10 ? `${id.slice(0, 10)}…` : id)

export default function ReportsPage() {
  const t = useTranslations()
  const { currentClinic } = useCurrentClinic()
  const { dashboardData, insights, kpis, loading } = useReports({ clinicId: currentClinic?.id })

  const metricCards = [
    {
      title: t('reports.metrics.patientsMonth'),
      value: dashboardData.patientsMonth,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      format: 'number'
    },
    {
      title: t('reports.metrics.treatmentsMonth'),
      value: dashboardData.treatmentsMonth,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      format: 'number'
    },
    {
      title: t('reports.metrics.revenueMonth'),
      value: dashboardData.revenueMonth,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      format: 'currency'
    },
    {
      title: t('reports.metrics.averageMargin'),
      value: dashboardData.averageMargin,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      format: 'percentage'
    }
  ]

  const predictions = insights?.revenue_predictions
  const serviceAnalysis = insights?.service_analysis
  const mostProfitable = serviceAnalysis?.most_profitable?.slice(0, 2) ?? []
  const growthOpportunities = serviceAnalysis?.growth_opportunities?.slice(0, 2) ?? []
  const decliningServices = serviceAnalysis?.declining_services?.slice(0, 3) ?? []
  const hasInsights = Boolean(insights)

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('reports.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t('reports.tabs.advanced')}
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              {t('reports.tabs.marketing')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{t('reports.overview.summary.title')}</CardTitle>
                  <CardDescription>{t('reports.overview.summary.subtitle')}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[0, 1, 2].map(item => (
                      <div key={item} className="space-y-3 rounded-lg border border-border/60 p-5">
                        <span className="block h-4 w-28 animate-pulse rounded bg-muted" />
                        <span className="block h-6 w-24 animate-pulse rounded bg-muted" />
                        <span className="block h-4 w-32 animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                ) : !predictions ? (
                  <p className="text-sm text-muted-foreground">
                    {t('reports.overview.summary.empty')}
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      {
                        key: 'next_month' as PredictionKey,
                        icon: Calendar,
                        label: t('reports.overview.summary.labels.nextMonth'),
                      },
                      {
                        key: 'next_quarter' as PredictionKey,
                        icon: Target,
                        label: t('reports.overview.summary.labels.nextQuarter'),
                      },
                      {
                        key: 'year_end' as PredictionKey,
                        icon: Sparkles,
                        label: t('reports.overview.summary.labels.yearEnd'),
                      },
                    ].map(item => {
                      const Icon = item.icon
                      const prediction = predictions[item.key]
                      const confidence = prediction?.confidence ?? 0
                      const badge =
                        confidence >= 0.75
                          ? { tone: 'success', label: t('reports.advanced.confidence.high') }
                          : confidence >= 0.5
                          ? { tone: 'info', label: t('reports.advanced.confidence.medium') }
                          : { tone: 'warning', label: t('reports.advanced.confidence.low') }

                      return (
                        <Card key={item.key} className="border border-border/60 shadow-sm">
                          <CardContent className="space-y-3 p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium text-muted-foreground">
                                  {item.label}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-xs ${confidenceToneClass[badge.tone]}`}
                              >
                                {badge.label}
                              </Badge>
                            </div>
                            <p className="text-2xl font-semibold text-foreground">
                              {formatCurrency(prediction?.predictedValue ?? 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('reports.overview.summary.range', {
                                min: formatCurrency(prediction?.confidence_interval?.[0] ?? 0),
                                max: formatCurrency(prediction?.confidence_interval?.[1] ?? 0),
                              })}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Main metrics */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {metricCards.map((metric, index) => {
                const Icon = metric.icon
                return (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{metric.title}</p>
                          <p className="text-2xl font-bold mt-2">
                            {loading ? (
                              <span className="h-8 w-24 bg-muted rounded animate-pulse block" />
                            ) : (
                              metric.format === 'currency' 
                                ? formatCurrency(metric.value)
                                : metric.format === 'percentage'
                                ? `${metric.value}%`
                                : metric.value
                            )}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                          <Icon className={`h-6 w-6 ${metric.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Detail summary */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t('reports.summary.monthTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">{t('reports.summary.newPatients')}</span>
                      <span className="font-medium">
                        {loading ? <span className="h-4 w-12 bg-muted rounded animate-pulse inline-block" /> : dashboardData.patientsMonth}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">{t('reports.summary.completedTreatments')}</span>
                      <span className="font-medium">
                        {loading ? <span className="h-4 w-12 bg-muted rounded animate-pulse inline-block" /> : dashboardData.treatmentsMonth}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('reports.summary.averagePerTreatment')}</span>
                      <span className="font-medium">
                        {loading ? (
                          <span className="h-4 w-16 bg-muted rounded animate-pulse inline-block" />
                        ) : (
                          dashboardData.treatmentsMonth > 0 
                            ? formatCurrency(dashboardData.revenueMonth / dashboardData.treatmentsMonth)
                            : formatCurrency(0)
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('reports.financial.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">{t('reports.financial.totalRevenue')}</span>
                      <span className="font-medium">
                        {loading ? <span className="h-4 w-20 bg-muted rounded animate-pulse inline-block" /> : formatCurrency(dashboardData.revenueMonth)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">{t('reports.financial.averageMargin')}</span>
                      <span className="font-medium">
                        {loading ? <span className="h-4 w-12 bg-muted rounded animate-pulse inline-block" /> : `${dashboardData.averageMargin}%`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('reports.financial.patientsServed')}</span>
                      <span className="font-medium">
                        {loading ? <span className="h-4 w-12 bg-muted rounded animate-pulse inline-block" /> : dashboardData.patientsMonth}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {hasInsights && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpCircle className="h-5 w-5" />
                      {t('reports.overview.highlights.title')}
                    </CardTitle>
                    <CardDescription>{t('reports.overview.highlights.subtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mostProfitable.length === 0 && growthOpportunities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('reports.overview.highlights.empty')}
                      </p>
                    ) : (
                      <>
                        {mostProfitable.map(service => (
                          <div key={`${service.service_id}-profit`} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">
                                {t('reports.advanced.services.serviceId', {
                                  id: formatServiceId(service.service_id),
                                })}
                              </p>
                              <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                                {service.roi.toFixed(1)}% ROI
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('reports.overview.highlights.margin', { margin: service.average_margin.toFixed(1) })}
                            </p>
                          </div>
                        ))}

                        {growthOpportunities.map(opportunity => (
                          <div key={`${opportunity.service_id}-growth`} className="rounded-lg border border-dashed p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">
                                {t('reports.advanced.services.serviceId', {
                                  id: formatServiceId(opportunity.service_id),
                                })}
                              </p>
                              <Badge variant="outline" className="text-xs bg-sky-100 text-sky-700 border-sky-200">
                                {t('reports.overview.highlights.potential', {
                                  value: formatCurrency(opportunity.potential_revenue),
                                })}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('reports.overview.highlights.frequency', { count: opportunity.frequency })}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {hasInsights && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-5 w-5" />
                      {t('reports.overview.alerts.title')}
                    </CardTitle>
                    <CardDescription>{t('reports.overview.alerts.subtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {decliningServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('reports.overview.alerts.empty')}</p>
                    ) : (
                      decliningServices.map(service => (
                        <div key={`${service.service_id}-decline`} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div>
                            <p className="font-medium text-amber-900">
                              {t('reports.advanced.services.serviceId', {
                                id: formatServiceId(service.service_id),
                              })}
                            </p>
                            <p className="text-xs text-amber-800">
                              {t('reports.overview.alerts.message')}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-amber-700">
                            -{(service.decline_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                  <CardFooter className="justify-end">
                    <a href="#advanced" className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline">
                      {t('reports.overview.alerts.cta')}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </CardFooter>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" id="advanced" className="space-y-6">
            <ReportsAdvanced insights={insights} kpis={kpis} loading={loading} />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-6">
            <ReportsMarketing clinicId={currentClinic?.id} insights={insights} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
