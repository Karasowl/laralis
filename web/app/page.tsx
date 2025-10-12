'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useWorkspace } from '@/contexts/workspace-context'
import { useDashboard } from '@/hooks/use-dashboard'
import { useReports } from '@/hooks/use-reports'
import { formatCurrency } from '@/lib/format'
import { ReportsAdvanced } from '@/app/reports/ReportsAdvanced'
import { ReportsMarketing } from '@/app/reports/ReportsMarketing'
import {
  Users,
  DollarSign,
  TrendingUp,
  Receipt,
  Activity,
  Package,
  ShoppingCart,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  ArrowUpCircle
} from 'lucide-react'

type PredictionKey = 'next_month' | 'next_quarter' | 'year_end'

const confidenceToneClass: Record<'success' | 'info' | 'warning', string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200'
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-32" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

function QuickActions({ onRefresh }: { onRefresh: () => void }) {
  const t = useTranslations('dashboard')
  const tNav = useTranslations('navigation')
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('quick_actions')}</CardTitle>
        <CardDescription>{t('common_tasks')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => router.push('/treatments/new')}
          >
            <Activity className="h-4 w-4 mr-2" />
            {t('new_treatment')}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => router.push('/patients/new')}
          >
            <Users className="h-4 w-4 mr-2" />
            {t('new_patient')}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => router.push('/expenses/new')}
          >
            <Receipt className="h-4 w-4 mr-2" />
            {t('record_expense')}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh_data')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertsSection({ lowStockCount }: { lowStockCount: number }) {
  const t = useTranslations('dashboard')
  const router = useRouter()

  if (lowStockCount === 0) return null

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-yellow-900">{t('alerts')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-yellow-800">
              {t('low_stock_items', { count: lowStockCount })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/supplies?filter=low-stock')}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('view_supplies')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function InsightsPage() {
  const t = useTranslations('dashboard')
  const tNav = useTranslations('navigation')
  const tReports = useTranslations('reports')
  const router = useRouter()
  const { currentClinic } = useWorkspace()
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [mounted, setMounted] = useState(false)

  const {
    metrics,
    charts,
    activities,
    loading: dashboardLoading,
    error: dashboardError
  } = useDashboard({
    clinicId: currentClinic?.id,
    period,
    from: dateFrom || undefined,
    to: dateTo || undefined
  })

  const {
    insights,
    kpis,
    loading: reportsLoading,
    error: reportsError,
    fetchReportsData
  } = useReports({ clinicId: currentClinic?.id })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleRefresh = () => {
    fetchReportsData()
    window.location.reload()
  }

  const isLoading = (dashboardLoading && !mounted) || reportsLoading
  const hasInsights = Boolean(insights)
  const predictions = insights?.revenue_predictions
  const serviceAnalysis = insights?.service_analysis
  const mostProfitable = serviceAnalysis?.most_profitable?.slice(0, 2) ?? []
  const growthOpportunities = serviceAnalysis?.growth_opportunities?.slice(0, 2) ?? []
  const decliningServices = serviceAnalysis?.declining_services?.slice(0, 3) ?? []

  const predictionOrder: PredictionKey[] = useMemo(
    () => ['next_month', 'next_quarter', 'year_end'],
    []
  )

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
          actions={
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
                aria-label="Periodo"
              >
                <option value="day">{t('today')}</option>
                <option value="week">{t('this_week')}</option>
                <option value="month">{t('this_month')}</option>
                <option value="year">{t('this_year')}</option>
                <option value="custom">{t('custom')}</option>
              </select>
              {period === 'custom' && (
                <>
                  <input
                    type="date"
                    className="h-9 rounded-md border px-2 text-sm"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <input
                    type="date"
                    className="h-9 rounded-md border px-2 text-sm"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </>
              )}
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('refresh')}
              </Button>
            </div>
          }
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:max-w-xl">
            <TabsTrigger value="overview">{tReports('tabs.overview')}</TabsTrigger>
            <TabsTrigger value="advanced">{tReports('tabs.advanced')}</TabsTrigger>
            <TabsTrigger value="marketing">{tReports('tabs.marketing')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {isLoading ? (
              <DashboardSkeleton />
            ) : (
              <>
                {(dashboardError || reportsError) && (
                  <Alert variant="destructive">
                    <AlertTitle>{t('error_loading')}</AlertTitle>
                    <AlertDescription>
                      {dashboardError || reportsError || t('error_generic')}
                    </AlertDescription>
                    <Button onClick={handleRefresh} className="mt-4">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('retry')}
                    </Button>
                  </Alert>
                )}

                {metrics.supplies.lowStock > 0 && (
                  <AlertsSection lowStockCount={metrics.supplies.lowStock} />
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    title={t('monthly_revenue')}
                    value={formatCurrency(metrics.revenue.current)}
                    change={metrics.revenue.change}
                    changeType={metrics.revenue.change > 0 ? 'increase' : 'decrease'}
                    icon={DollarSign}
                    color="text-green-600"
                    subtitle={t('vs_previous_month')}
                  />

                  <MetricCard
                    title={t('monthly_expenses')}
                    value={formatCurrency(metrics.expenses.current)}
                    change={metrics.expenses.change}
                    changeType={metrics.expenses.change > 0 ? 'increase' : 'decrease'}
                    icon={Receipt}
                    color="text-red-600"
                    subtitle={t('vs_previous_month')}
                  />

                  <MetricCard
                    title={t('active_patients')}
                    value={metrics.patients.total}
                    change={metrics.patients.change}
                    changeType="increase"
                    icon={Users}
                    color="text-blue-600"
                    subtitle={`${metrics.patients.new} ${t('new_this_month')}`}
                  />

                  <MetricCard
                    title={tNav('treatments')}
                    value={metrics.treatments.total}
                    icon={Activity}
                    color="text-purple-600"
                    subtitle={`${metrics.treatments.completed} ${t('completed')}`}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <RevenueChart
                    data={charts.revenue}
                    title={t('revenue_vs_expenses')}
                    description={t('monthly_comparison')}
                  />
                  <CategoryBreakdown
                    data={charts.categories}
                    title={t('services_breakdown')}
                    description={t('by_category')}
                  />
                </div>

                {hasInsights && (
                  <div className="grid gap-4 md:grid-cols-3">
                    {predictionOrder.map((key) => {
                      const prediction = predictions?.[key]
                      if (!prediction) return null

                      const tone =
                        confidenceToneClass[
                          (prediction.confidence as 'success' | 'info' | 'warning') || 'info'
                        ]

                      return (
                        <Card key={key} className="border border-dashed">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">
                                  {tReports(`overview.predictions.${key}.title`)}
                                </CardTitle>
                                <CardDescription>
                                  {tReports(`overview.predictions.${key}.subtitle`)}
                                </CardDescription>
                              </div>
                              <Badge className={tone}>
                                {tReports('overview.predictions.confidence', {
                                  value: Math.round(prediction.confidence_score * 100)
                                })}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="text-2xl font-semibold">
                              {formatCurrency(prediction.amount)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {prediction.comment ||
                                tReports(`overview.predictions.${key}.description`)}
                            </p>
                            <Progress value={prediction.confidence_score * 100} />
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {hasInsights && (mostProfitable.length > 0 || growthOpportunities.length > 0) && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle>{tReports('overview.highlights.title')}</CardTitle>
                          <CardDescription>{tReports('overview.highlights.subtitle')}</CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1 text-xs uppercase tracking-wide">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {tReports('overview.highlights.metric')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      {mostProfitable.map((service) => (
                        <div key={service.service_id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">
                                {service.service_name || service.service_id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tReports('overview.highlights.margin', {
                                  margin: service.average_margin.toFixed(1)
                                })}
                              </p>
                            </div>
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                              <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                              {service.roi.toFixed(1)}% ROI
                            </Badge>
                          </div>
                        </div>
                      ))}

                      {growthOpportunities.map((service) => (
                        <div
                          key={`${service.service_id}-opportunity`}
                          className="rounded-lg border border-dashed p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">
                                {service.service_name || service.service_id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tReports('overview.highlights.frequency', {
                                  count: service.frequency
                                })}
                              </p>
                            </div>
                            <Badge variant="outline" className="bg-sky-100 text-sky-700">
                              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                              {tReports('overview.highlights.potential', {
                                value: formatCurrency(service.potential_revenue)
                              })}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {hasInsights && decliningServices.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                        {tReports('overview.alerts.title')}
                      </CardTitle>
                      <CardDescription>{tReports('overview.alerts.subtitle')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {decliningServices.map((service) => (
                        <div
                          key={`${service.service_id}-decline`}
                          className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3"
                        >
                          <div>
                            <p className="font-medium text-amber-700">
                              {service.service_name || service.service_id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tReports('overview.alerts.message')}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-amber-700">
                            -{(service.decline_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <RecentActivity
                    activities={activities}
                    title={t('recent_activity')}
                    description={t('latest_clinic_actions')}
                  />
                  <QuickActions onRefresh={handleRefresh} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="advanced">
            <ReportsAdvanced insights={insights} kpis={kpis} loading={reportsLoading} />
          </TabsContent>

          <TabsContent value="marketing">
            <ReportsMarketing
              clinicId={currentClinic?.id}
              insights={insights}
              loading={reportsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
