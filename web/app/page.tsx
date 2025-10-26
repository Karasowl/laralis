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
import { BreakEvenProgress } from '@/components/dashboard/BreakEvenProgress'
import { BusinessMetricsGrid } from '@/components/dashboard/BusinessMetricsGrid'
import { DateFilterBar } from '@/components/dashboard/DateFilterBar'
import { PeriodBreakdown } from '@/components/dashboard/PeriodBreakdown'
import { MarketingROISimple } from '@/components/dashboard/MarketingROISimple'
import { ServiceROIAnalysis } from '@/components/dashboard/ServiceROIAnalysis'
import { ProfitabilitySummary } from '@/components/dashboard/profitability/ProfitabilitySummary'
import { MarketingMetrics } from '@/components/dashboard/marketing/MarketingMetrics'
import { AcquisitionTrendsChart } from '@/components/dashboard/marketing/AcquisitionTrendsChart'
import { ChannelROIChart } from '@/components/dashboard/marketing/ChannelROIChart'
import { CACTrendChart } from '@/components/dashboard/marketing/CACTrendChart'
import { MonthlyProfitSimulator } from '@/components/dashboard/MonthlyProfitSimulator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useWorkspace } from '@/contexts/workspace-context'
import { useDashboard } from '@/hooks/use-dashboard'
import { useReports } from '@/hooks/use-reports'
import { useEquilibrium } from '@/hooks/use-equilibrium'
import { useDateFilter } from '@/hooks/use-date-filter'
import { useServiceROI } from '@/hooks/use-service-roi'
import { useMarketingMetrics } from '@/hooks/use-marketing-metrics'
import { useCACTrend } from '@/hooks/use-cac-trend'
import { useChannelROI } from '@/hooks/use-channel-roi'
import { formatCurrency } from '@/lib/format'
import { ReportsAdvanced } from '@/app/reports/ReportsAdvanced'
import { ReportsMarketing } from '@/app/reports/ReportsMarketing'
import {
  Users,
  DollarSign,
  Receipt,
  Activity,
  ShoppingCart,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

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

// Componente removido - acciones disponibles desde el menú principal
// function QuickActions({ onRefresh }: { onRefresh: () => void }) {
//   const t = useTranslations('dashboard')
//   const tNav = useTranslations('navigation')
//   const router = useRouter()

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>{t('quick_actions')}</CardTitle>
//         <CardDescription>{t('common_tasks')}</CardDescription>
//       </CardHeader>
//       <CardContent>
//         <div className="grid grid-cols-2 gap-2">
//           <Button
//             variant="outline"
//             className="justify-start"
//             onClick={() => router.push('/treatments/new')}
//           >
//             <Activity className="h-4 w-4 mr-2" />
//             {t('new_treatment')}
//           </Button>
//           <Button
//             variant="outline"
//             className="justify-start"
//             onClick={() => router.push('/patients/new')}
//           >
//             <Users className="h-4 w-4 mr-2" />
//             {t('new_patient')}
//           </Button>
//           <Button
//             variant="outline"
//             className="justify-start"
//             onClick={() => router.push('/expenses/new')}
//           >
//             <Receipt className="h-4 w-4 mr-2" />
//             {t('record_expense')}
//           </Button>
//           <Button
//             variant="outline"
//             className="justify-start"
//             onClick={onRefresh}
//           >
//             <RefreshCw className="h-4 w-4 mr-2" />
//             {t('refresh_data')}
//           </Button>
//         </div>
//       </CardContent>
//     </Card>
//   )
// }

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
  const [mounted, setMounted] = useState(false)

  // Use centralized date filter hook
  const {
    period: filterPeriod,
    granularity,
    comparison,
    customRange,
    currentRange,
    previousRange,
    setPeriod: setFilterPeriod,
    setGranularity,
    setComparison,
    setCustomRange
  } = useDateFilter()

  const {
    metrics,
    charts,
    activities,
    loading: dashboardLoading,
    error: dashboardError
  } = useDashboard({
    clinicId: currentClinic?.id,
    period: filterPeriod,
    from: customRange?.from || undefined,
    to: customRange?.to || undefined,
    chartGranularity: granularity
  })

  const {
    insights,
    kpis,
    loading: reportsLoading,
    error: reportsError,
    fetchReportsData
  } = useReports({ clinicId: currentClinic?.id })

  const {
    data: equilibriumData,
    loading: equilibriumLoading
  } = useEquilibrium({ clinicId: currentClinic?.id })

  const {
    data: roiData,
    loading: roiLoading
  } = useServiceROI({ clinicId: currentClinic?.id, days: 30 })

  // Marketing hooks
  const {
    data: marketingMetrics,
    loading: marketingMetricsLoading
  } = useMarketingMetrics({ clinicId: currentClinic?.id, period: 30 })

  const {
    data: cacTrendData,
    loading: cacTrendLoading
  } = useCACTrend({ clinicId: currentClinic?.id, months: 12 })

  const {
    data: channelROIData,
    loading: channelROILoading
  } = useChannelROI({ clinicId: currentClinic?.id, period: 30 })

  useEffect(() => {
    console.log('[Dashboard] useServiceROI - clinicId:', currentClinic?.id, 'data:', roiData, 'loading:', roiLoading)
  }, [currentClinic?.id, roiData, roiLoading])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleRefresh = () => {
    fetchReportsData()
    window.location.reload()
  }

  // Dynamic labels based on selected period
  const getPeriodLabels = useMemo(() => {
    switch (filterPeriod) {
      case 'day':
        return {
          revenue: t('daily_revenue'),
          expenses: t('daily_expenses'),
          comparison: t('vs_previous_day'),
          newPatients: t('new_today'),
        }
      case 'week':
        return {
          revenue: t('weekly_revenue'),
          expenses: t('weekly_expenses'),
          comparison: t('vs_previous_week'),
          newPatients: t('new_this_week'),
        }
      case 'year':
        return {
          revenue: t('yearly_revenue'),
          expenses: t('yearly_expenses'),
          comparison: t('vs_previous_year'),
          newPatients: t('new_this_year'),
        }
      case 'custom':
        return {
          revenue: t('period_revenue'),
          expenses: t('period_expenses'),
          comparison: t('vs_previous_period'),
          newPatients: t('new_in_period'),
        }
      default: // 'month'
        return {
          revenue: t('monthly_revenue'),
          expenses: t('monthly_expenses'),
          comparison: t('vs_previous_month'),
          newPatients: t('new_this_month'),
        }
    }
  }, [filterPeriod, t])

  const isLoading = (dashboardLoading && !mounted) || reportsLoading

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
          actions={
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('refresh')}
            </Button>
          }
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 md:max-w-2xl">
            <TabsTrigger value="overview">{tReports('tabs.overview')}</TabsTrigger>
            <TabsTrigger value="profitability">{tReports('tabs.profitability')}</TabsTrigger>
            <TabsTrigger value="advanced">{tReports('tabs.patientsCapacity')}</TabsTrigger>
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

                {/* Break-Even Progress */}
                {!equilibriumLoading && equilibriumData && equilibriumData.monthlyTargetCents > 0 && (
                  <BreakEvenProgress
                    monthlyTargetCents={equilibriumData.monthlyTargetCents}
                    currentRevenueCents={equilibriumData.currentRevenueCents}
                    progressPercentage={equilibriumData.progressPercentage}
                    dailyTargetCents={equilibriumData.dailyTargetCents}
                    daysToBreakEven={equilibriumData.daysToBreakEven}
                    revenueGapCents={equilibriumData.revenueGapCents}
                    actualDaysWorked={equilibriumData.actualDaysWorked}
                    totalWorkDaysInPeriod={equilibriumData.totalWorkDaysInPeriod}
                    elapsedDays={equilibriumData.elapsedDays}
                    remainingWorkingDays={equilibriumData.remainingWorkingDays}
                  />
                )}

                {/* 4 Key Metrics Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    title={getPeriodLabels.revenue}
                    value={formatCurrency(metrics.revenue.current)}
                    valueInCents={metrics.revenue.current}
                    change={metrics.revenue.change}
                    changeType={metrics.revenue.change > 0 ? 'increase' : 'decrease'}
                    icon={DollarSign}
                    color="text-green-600"
                    subtitle={getPeriodLabels.comparison}
                  />

                  <MetricCard
                    title={getPeriodLabels.expenses}
                    value={formatCurrency(metrics.expenses.current)}
                    valueInCents={metrics.expenses.current}
                    change={metrics.expenses.change}
                    changeType={metrics.expenses.change > 0 ? 'increase' : 'decrease'}
                    icon={Receipt}
                    color="text-red-600"
                    subtitle={getPeriodLabels.comparison}
                  />

                  <MetricCard
                    title={t('active_patients')}
                    value={metrics.patients.total}
                    change={metrics.patients.change}
                    changeType="increase"
                    icon={Users}
                    color="text-blue-600"
                    subtitle={`${metrics.patients.new} ${getPeriodLabels.newPatients}`}
                  />

                  <MetricCard
                    title={tNav('treatments')}
                    value={metrics.treatments.total}
                    icon={Activity}
                    color="text-purple-600"
                    subtitle={`${metrics.treatments.completed} ${t('completed')}`}
                  />
                </div>

                {/* Business Metrics Grid */}
                {kpis && !equilibriumLoading && equilibriumData && (
                  <BusinessMetricsGrid
                    ticketPromedioCents={kpis.avgTreatmentValue}
                    pacientesNecesariosPorDia={(() => {
                      // SMART CALCULATION: Based on remaining days, not ideal daily target
                      const remainingDays = Math.max(1, equilibriumData.remainingWorkingDays || 1)
                      const revenueNeeded = Math.max(0, equilibriumData.revenueGapCents)
                      const dailyRevenueNeeded = revenueNeeded / remainingDays

                      // Use actual ticket average if we have enough data (at least 5 treatments)
                      // Otherwise use assumed minimum ticket of $500 MXN (50000 cents)
                      const MIN_SAMPLE_SIZE = 5
                      const ASSUMED_TICKET_CENTS = 50000 // $500 MXN

                      const ticketToUse = kpis.totalTreatments >= MIN_SAMPLE_SIZE && kpis.avgTreatmentValue > 0
                        ? kpis.avgTreatmentValue
                        : ASSUMED_TICKET_CENTS

                      return ticketToUse > 0
                        ? Math.ceil(dailyRevenueNeeded / ticketToUse)
                        : 0
                    })()}
                    pacientesActualesPorDia={kpis.avgPatientsPerDay || 0}
                    gananciaNetaCents={metrics.revenue.current - metrics.expenses.current}
                    gananciaNetaChange={metrics.revenue.change - metrics.expenses.change}
                    workDays={equilibriumData.workDays}
                    monthlyTargetCents={equilibriumData.monthlyTargetCents}
                    daysElapsed={equilibriumData.elapsedDays}
                  />
                )}

                {/* GRÁFICOS PRINCIPALES - CRÍTICO PARA CONTEXTO HISTÓRICO */}
                <div className="grid gap-4 md:grid-cols-2">
                  <RevenueChart
                    data={charts.revenue}
                    title={t('revenue_vs_expenses')}
                    description={t('monthly_comparison')}
                    onGranularityChange={setGranularity}
                    currentGranularity={granularity}
                  />
                  <CategoryBreakdown
                    data={charts.categories}
                    title={t('services_breakdown')}
                    description={t('by_category')}
                  />
                </div>

                {/* Alertas y Actividad Reciente */}
                <div className="grid gap-4 md:grid-cols-1">
                  <RecentActivity
                    activities={activities}
                    title={t('recent_activity')}
                    description={t('latest_clinic_actions')}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="profitability" className="space-y-6">
            {/* Summary Cards */}
            <ProfitabilitySummary services={roiData?.services || []} loading={roiLoading} />

            {/* Full ROI Analysis Table */}
            <ServiceROIAnalysis data={roiData} loading={roiLoading} />
          </TabsContent>

          <TabsContent value="advanced">
            <ReportsAdvanced insights={insights} kpis={kpis} loading={reportsLoading} />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-6">
            {/* Marketing Metrics Summary */}
            <MarketingMetrics
              cac={marketingMetrics?.metrics.cac.cents || 0}
              ltv={marketingMetrics?.metrics.ltv.cents || 0}
              conversionRate={marketingMetrics?.metrics.conversionRate.value || 0}
              loading={marketingMetricsLoading}
            />

            {/* Acquisition Trends - Mantener mock por ahora (requiere endpoint adicional) */}
            <AcquisitionTrendsChart
              data={(() => {
                // Mock 12 months + 3 projection months
                const months = ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene']
                const projectionMonths = ['Feb', 'Mar', 'Abr']

                const historical = months.map((month, i) => ({
                  month,
                  patients: Math.floor(15 + Math.random() * 10 + (i * 0.5))
                }))

                const projection = projectionMonths.map((month, i) => ({
                  month,
                  projection: Math.floor(25 + Math.random() * 5 + (i * 0.5))
                }))

                return [...historical, ...projection]
              })()}
              loading={false}
            />

            {/* Charts Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Channel ROI */}
              <ChannelROIChart
                data={(channelROIData?.channels || []).map(channel => ({
                  channel: channel.source.name,
                  roi: channel.roi.value,
                  spent_cents: channel.investmentCents,
                  revenue_cents: channel.revenueCents,
                  patients: channel.patients,
                  trend: [] // Trend histórico requiere endpoint adicional
                }))}
                loading={channelROILoading}
              />

              {/* CAC Evolution */}
              <CACTrendChart
                data={(cacTrendData?.trend || []).map(month => ({
                  month: month.month,
                  cac_cents: month.cacCents
                }))}
                targetCAC={cacTrendData?.summary.averageCACCents || 0}
                loading={cacTrendLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
