'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { useWorkspace } from '@/contexts/workspace-context'
import { useDashboard } from '@/hooks/use-dashboard'
import { formatCurrency } from '@/lib/format'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Receipt,
  Activity,
  Package,
  ShoppingCart,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

// Loading skeleton component
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
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
    </div>
  )
}

// Quick actions component
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

// Alerts component
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
              onClick={() => router.push('/supplies')}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
            >
              {t('view_supplies')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tNav = useTranslations('navigation')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { currentClinic, workspace, loading: workspaceLoading } = useWorkspace()
  
  // Filters
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Dashboard data
  const { metrics, charts, activities, loading, error } = useDashboard({
    clinicId: currentClinic?.id,
    period,
    from: period === 'custom' ? dateFrom : undefined,
    to: period === 'custom' ? dateTo : undefined
  })

  // Redirect if no workspace
  useEffect(() => {
    if (!workspace && !workspaceLoading) {
      router.push('/onboarding')
    }
  }, [workspace, workspaceLoading, router])

  // Mock data for charts (replace with actual data from API)
  const revenueData = charts.revenue

  const categoryData = charts.categories

  // Real recent activities (no mocks)
  const recentActivities = activities

  const handleRefresh = () => {
    window.location.reload()
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
          />
          <DashboardSkeleton />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-lg font-medium">{t('error_loading')}</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <Button onClick={handleRefresh} className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
          actions={
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border px-2 text-sm"
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
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
                  <input type="date" className="h-9 rounded-md border px-2 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <input type="date" className="h-9 rounded-md border px-2 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </>
              )}
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('refresh')}
              </Button>
            </div>
          }
        />

        {/* Alerts */}
        {metrics.supplies.lowStock > 0 && (
          <AlertsSection lowStockCount={metrics.supplies.lowStock} />
        )}

        {/* Key Metrics */}
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

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart
            data={revenueData}
            title={t('revenue_vs_expenses')}
            description={t('monthly_comparison')}
          />
          
          <CategoryBreakdown
            data={categoryData}
            title={t('services_breakdown')}
            description={t('by_category')}
          />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <RecentActivity
            activities={recentActivities}
            title={t('recent_activity')}
            description={t('latest_clinic_actions')}
          />
          
          <QuickActions onRefresh={handleRefresh} />
        </div>

        {/* Appointments Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('appointments')}</CardTitle>
                <CardDescription>
                  {t('appointments_coming_soon')}
                </CardDescription>
              </div>
              <Badge variant="outline" className="uppercase tracking-wide text-xs">
                {tCommon('comingSoon')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('appointments_coming_soon_description')}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
