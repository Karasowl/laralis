'use client'

import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity,
  FileText,
  Package,
  Brain,
  BarChart3
} from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useReports } from '@/hooks/use-reports'
import { ReportsAdvanced } from './ReportsAdvanced'

export default function ReportsPage() {
  const t = useTranslations()
  const { currentClinic } = useCurrentClinic()
  const { dashboardData, loading } = useReports({ clinicId: currentClinic?.id })

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

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('reports.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t('reports.tabs.advanced')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Main metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Activity summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            </div>
          </TabsContent>

          <TabsContent value="advanced">
            <ReportsAdvanced />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}