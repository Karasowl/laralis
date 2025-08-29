'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
  Calendar,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const router = useRouter()
  const { currentClinic, currentWorkspace } = useWorkspace()
  
  // Dashboard data
  const { metrics, charts, activities, loading, error } = useDashboard({
    clinicId: currentClinic?.id,
    period: 'month'
  })

  // Redirect if no workspace
  useEffect(() => {
    if (!currentWorkspace && !loading) {
      router.push('/onboarding')
    }
  }, [currentWorkspace, loading, router])

  // Mock data for charts (replace with actual data from API)
  const revenueData = charts.revenue.length > 0 ? charts.revenue : [
    { month: 'Ene', revenue: 45000, expenses: 32000 },
    { month: 'Feb', revenue: 52000, expenses: 35000 },
    { month: 'Mar', revenue: 48000, expenses: 33000 },
    { month: 'Abr', revenue: 61000, expenses: 38000 },
    { month: 'May', revenue: 58000, expenses: 36000 },
    { month: 'Jun', revenue: 65000, expenses: 40000 }
  ]

  const categoryData = charts.categories.length > 0 ? charts.categories : [
    { name: 'Ortodoncia', value: 350 },
    { name: 'Limpieza', value: 280 },
    { name: 'Endodoncia', value: 180 },
    { name: 'Cirugía', value: 120 },
    { name: 'Otros', value: 70 }
  ]

  // Mock activities (replace with actual data)
  const recentActivities = activities.length > 0 ? activities : [
    {
      id: '1',
      type: 'treatment' as const,
      title: 'Tratamiento completado',
      description: 'Limpieza dental - Juan Pérez',
      amount: 85000,
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      user: 'Dr. García'
    },
    {
      id: '2',
      type: 'patient' as const,
      title: 'Nuevo paciente',
      description: 'María López',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      user: 'Recepción'
    },
    {
      id: '3',
      type: 'expense' as const,
      title: 'Gasto registrado',
      description: 'Compra de insumos',
      amount: 45000,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      user: 'Admin'
    }
  ]

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
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('refresh')}
            </Button>
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
            title={t('treatments')}
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
                  {t('upcoming_appointments')}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/appointments')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {t('view_calendar')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('today')}</p>
                <p className="text-2xl font-bold">{metrics.appointments.today}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('this_week')}</p>
                <p className="text-2xl font-bold">{metrics.appointments.week}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}