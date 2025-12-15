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
// ProfitabilitySummary removed (Bug #24) - ServiceROIAnalysis already includes summary cards
import { MarketingMetrics } from '@/components/dashboard/marketing/MarketingMetrics'
import { AcquisitionTrendsChart } from '@/components/dashboard/marketing/AcquisitionTrendsChart'
import { ChannelROIChart } from '@/components/dashboard/marketing/ChannelROIChart'
import { CACTrendChart } from '@/components/dashboard/marketing/CACTrendChart'
import { CampaignROISection } from '@/components/dashboard/CampaignROISection'
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
import { useAcquisitionTrends } from '@/hooks/use-acquisition-trends'
import { useProfitAnalysis } from '@/hooks/use-profit-analysis'
import { usePlannedVsActual } from '@/hooks/use-planned-vs-actual'
import { useServices } from '@/hooks/use-services'
import { useTimeSettings } from '@/hooks/use-time-settings'
import { PlannedVsActualCard } from '@/components/dashboard/PlannedVsActualCard'
import { ProfitBreakdownCard } from '@/components/dashboard/ProfitBreakdownCard'
import { ContributionAnalysis } from '@/app/equilibrium/components/ContributionAnalysis'
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
      {/* Mobile-first: 1 col -> 2 cols (tablet) -> 4 cols (desktop) */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-32" />
            </CardHeader>
          </Card>
        ))}
      </div>
      {/* Charts: stack on mobile, side-by-side on tablet+ */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        <Skeleton className="h-72 md:h-80 lg:h-96" />
        <Skeleton className="h-72 md:h-80 lg:h-96" />
      </div>
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        <Skeleton className="h-64 md:h-72 lg:h-80" />
        <Skeleton className="h-64 md:h-72 lg:h-80" />
      </div>
    </div>
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
    from: currentRange?.from,
    to: currentRange?.to,
    chartGranularity: granularity
  })

  const {
    insights,
    kpis,
    loading: reportsLoading,
    error: reportsError,
    fetchReportsData
  } = useReports({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  const {
    data: equilibriumData,
    loading: equilibriumLoading
  } = useEquilibrium({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  const {
    data: roiData,
    loading: roiLoading
  } = useServiceROI({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  // Marketing hooks
  const {
    data: marketingMetrics,
    loading: marketingMetricsLoading
  } = useMarketingMetrics({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  const {
    data: cacTrendData,
    loading: cacTrendLoading
  } = useCACTrend({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  const {
    data: channelROIData,
    loading: channelROILoading
  } = useChannelROI({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  const {
    data: acquisitionTrendsData,
    loading: acquisitionTrendsLoading
  } = useAcquisitionTrends({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to,
    projectionMonths: 3
  })

  // Services for advanced reports (to show names instead of IDs)
  const {
    services,
    loading: servicesLoading
  } = useServices({ clinicId: currentClinic?.id })

  // Time settings for monthly goal
  const {
    settings: timeSettings
  } = useTimeSettings({ clinicId: currentClinic?.id })

  // Profit Analysis - Correct financial metrics
  const {
    data: profitAnalysis,
    loading: profitAnalysisLoading
  } = useProfitAnalysis({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  // Planned vs Actual - Unique differentiator
  const {
    data: plannedVsActual,
    loading: plannedVsActualLoading
  } = usePlannedVsActual({
    clinicId: currentClinic?.id,
    startDate: currentRange?.from,
    endDate: currentRange?.to
  })

  useEffect(() => {
    console.log('[Dashboard] useServiceROI - clinicId:', currentClinic?.id, 'data:', roiData, 'loading:', roiLoading)
  }, [currentClinic?.id, roiData, roiLoading])

  useEffect(() => {
    setMounted(true)
  }, [])

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
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
        />

        <DateFilterBar
          period={filterPeriod}
          granularity={granularity}
          comparison={comparison}
          customRange={customRange}
          onPeriodChange={setFilterPeriod}
          onGranularityChange={setGranularity}
          onComparisonChange={setComparison}
          onCustomRangeChange={setCustomRange}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 md:max-w-2xl gap-2 h-auto p-2">
            <TabsTrigger value="overview" className="h-auto py-3 whitespace-normal text-xs md:text-sm">
              {tReports('tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="profitability" className="h-auto py-3 whitespace-normal text-xs md:text-sm">
              {tReports('tabs.profitability')}
            </TabsTrigger>
            <TabsTrigger value="advanced" className="h-auto py-3 whitespace-normal text-xs md:text-sm">
              {tReports('tabs.patientsCapacity')}
            </TabsTrigger>
            <TabsTrigger value="marketing" className="h-auto py-3 whitespace-normal text-xs md:text-sm">
              {tReports('tabs.marketing')}
            </TabsTrigger>
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
                    <Button onClick={() => fetchReportsData()} className="mt-4">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('retry')}
                    </Button>
                  </Alert>
                )}

                {metrics.supplies.lowStock > 0 && (
                  <AlertsSection lowStockCount={metrics.supplies.lowStock} />
                )}

                {/* Break-Even Progress & Contribution Analysis */}
                {!equilibriumLoading && equilibriumData && equilibriumData.monthlyTargetCents > 0 && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <BreakEvenProgress
                      monthlyTargetCents={equilibriumData.monthlyTargetCents}
                      monthlyGoalCents={timeSettings?.monthly_goal_cents}
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
                    <ContributionAnalysis
                      variableCostPercentage={equilibriumData.variableCostPercentage || 0}
                      contributionMargin={equilibriumData.contributionMargin || 0}
                      variableCostSource={equilibriumData.variableCostSource || 'fallback'}
                      autoVariableCostPercentage={equilibriumData.autoVariableCostPercentage || 0}
                      autoVariableCostSampleSize={equilibriumData.autoVariableCostSampleSize || 0}
                      autoVariableCostPeriodDays={equilibriumData.autoVariableCostPeriod?.days || 90}
                    />
                  </div>
                )}

                {/* 4 Key Metrics Cards - Mobile-first: 1 col -> 2 cols (tablet) -> 4 cols (desktop) */}
                <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                    color="text-destructive"
                    subtitle={getPeriodLabels.comparison}
                  />

                  <MetricCard
                    title={t('active_patients')}
                    value={metrics.patients.total}
                    change={metrics.patients.change}
                    changeType="increase"
                    icon={Users}
                    color="text-primary"
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

                {/* Financial Metrics - Mobile-first: 1 col -> 2 cols (tablet) -> 3 cols (desktop) */}
                {!profitAnalysisLoading && profitAnalysis && (
                  <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard
                      title={t('gross_profit')}
                      value={formatCurrency(profitAnalysis.profits.gross_profit_cents)}
                      valueInCents={profitAnalysis.profits.gross_profit_cents}
                      icon={DollarSign}
                      color="text-emerald-600"
                      subtitle={`${profitAnalysis.profits.gross_margin_pct.toFixed(1)}% ${t('gross_margin')}`}
                    />

                    <MetricCard
                      title={t('ebitda')}
                      value={formatCurrency(profitAnalysis.profits.ebitda_cents)}
                      valueInCents={profitAnalysis.profits.ebitda_cents}
                      icon={DollarSign}
                      color="text-primary"
                      subtitle={t('ebitda_description')}
                    />

                    <MetricCard
                      title={t('net_profit')}
                      value={formatCurrency(profitAnalysis.profits.net_profit_cents)}
                      valueInCents={profitAnalysis.profits.net_profit_cents}
                      icon={DollarSign}
                      color={profitAnalysis.profits.net_profit_cents > 0 ? 'text-emerald-600' : 'text-destructive'}
                      subtitle={`${profitAnalysis.profits.net_margin_pct.toFixed(1)}% ${t('margin')}`}
                    />
                  </div>
                )}

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
                    gananciaNetaCents={profitAnalysis?.profits.net_profit_cents || (metrics.revenue.current - metrics.expenses.current)}
                    gananciaNetaChange={profitAnalysis ? undefined : (metrics.revenue.change - metrics.expenses.change)}
                    workDays={equilibriumData.workDays}
                    monthlyTargetCents={equilibriumData.monthlyTargetCents}
                    daysElapsed={equilibriumData.elapsedDays}
                    hideNetProfit={true}
                  />
                )}

                {/* Profit Breakdown + Planned vs Actual */}
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
                  {/* Profit Breakdown - Clear cost deduction view */}
                  {!profitAnalysisLoading && profitAnalysis && (
                    <ProfitBreakdownCard
                      revenueCents={profitAnalysis.revenue_cents}
                      variableCostsCents={profitAnalysis.costs.variable_cents}
                      fixedCostsCents={profitAnalysis.costs.fixed_cents}
                      depreciationCents={profitAnalysis.costs.depreciation_cents}
                      netProfitCents={profitAnalysis.profits.net_profit_cents}
                      netMarginPct={profitAnalysis.profits.net_margin_pct}
                    />
                  )}

                  {/* Planned vs Actual - UNIQUE DIFFERENTIATOR */}
                  {!plannedVsActualLoading && plannedVsActual && (
                    <PlannedVsActualCard data={plannedVsActual} />
                  )}
                </div>

                {/* GRAFICOS PRINCIPALES - Mobile-first: stack on mobile, 2 cols on tablet+ */}
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
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
                <div className="grid gap-4 md:gap-6 grid-cols-1">
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
            {/* Full ROI Analysis (includes summary cards - Bug #24 fix: removed duplicate ProfitabilitySummary) */}
            <ServiceROIAnalysis data={roiData} loading={roiLoading} />
          </TabsContent>

          <TabsContent value="advanced">
            <ReportsAdvanced
              insights={insights}
              kpis={kpis}
              loading={reportsLoading || servicesLoading}
              services={services?.map(s => ({ id: s.id, name: s.name })) || []}
            />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-6">
            {/* Marketing Metrics Summary */}
            <MarketingMetrics
              cac={marketingMetrics?.metrics.cac.cents || 0}
              ltv={marketingMetrics?.metrics.ltv.cents || 0}
              conversionRate={marketingMetrics?.metrics.conversionRate.value || 0}
              loading={marketingMetricsLoading}
            />

            {/* Campaign ROI Analysis */}
            <CampaignROISection />

            {/* Acquisition Trends */}
            <AcquisitionTrendsChart
              data={acquisitionTrendsData}
              loading={acquisitionTrendsLoading}
            />

            {/* Charts Grid - Mobile-first: stack on mobile, 2 cols on tablet+ */}
            <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
              {/* Channel ROI */}
              <ChannelROIChart
                data={(channelROIData?.channels || []).map(channel => ({
                  // Support both old (source) and new (campaign) API response formats
                  channel: channel.campaign?.name || channel.source?.name || 'Unknown',
                  roi: channel.roi.value,
                  spent_cents: channel.investmentCents,
                  revenue_cents: channel.revenueCents,
                  patients: channel.patients,
                  trend: [] // Trend histórico requiere endpoint adicional
                }))}
                loading={channelROILoading}
                isEmpty={channelROIData?.isEmpty}
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
