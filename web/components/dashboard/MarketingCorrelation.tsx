'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MarketingROITable, CampaignROI } from './MarketingROITable'
import { MarketingTimeline, MarketingEvent, RevenueDataPoint } from './MarketingTimeline'
import { TrendingUp, Megaphone, Target, Lightbulb, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MarketingCorrelationProps {
  campaigns: CampaignROI[]
  events: MarketingEvent[]
  revenueData: RevenueDataPoint[]
  loading?: boolean
}

export function MarketingCorrelation({
  campaigns,
  events,
  revenueData,
  loading = false
}: MarketingCorrelationProps) {
  const t = useTranslations('dashboardComponents.marketingCorrelation')

  // Calculate correlations and insights
  const insights = useMemo(() => {
    if (campaigns.length === 0 || revenueData.length === 0) {
      return null
    }

    const totalInvestment = campaigns.reduce((sum, c) => sum + c.investmentCents, 0)
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenueCents, 0)
    const totalPatients = campaigns.reduce((sum, c) => sum + c.patientsCount, 0)
    const avgROI = totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment) * 100 : 0

    // Cost per patient
    const costPerPatient = totalPatients > 0 ? totalInvestment / totalPatients : 0

    // Revenue per patient
    const revenuePerPatient = totalPatients > 0 ? totalRevenue / totalPatients : 0

    // Find best performing platform
    const platformPerformance = campaigns.reduce((acc, campaign) => {
      const platform = campaign.platform || 'Unknown'
      if (!acc[platform]) {
        acc[platform] = {
          revenue: 0,
          investment: 0,
          patients: 0
        }
      }
      acc[platform].revenue += campaign.revenueCents
      acc[platform].investment += campaign.investmentCents
      acc[platform].patients += campaign.patientsCount
      return acc
    }, {} as Record<string, { revenue: number; investment: number; patients: number }>)

    const platforms = Object.entries(platformPerformance).map(([name, data]) => ({
      name,
      roi: data.investment > 0 ? ((data.revenue - data.investment) / data.investment) * 100 : 0,
      revenue: data.revenue,
      patients: data.patients
    })).sort((a, b) => b.roi - a.roi)

    const bestPlatform = platforms[0]
    const worstPlatform = platforms[platforms.length - 1]

    // Active campaigns performance
    const activeCampaigns = campaigns.filter(c => c.status === 'active')
    const avgActiveROI = activeCampaigns.length > 0
      ? activeCampaigns.reduce((sum, c) => sum + c.roi, 0) / activeCampaigns.length
      : 0

    return {
      totalInvestment,
      totalRevenue,
      totalPatients,
      avgROI,
      costPerPatient,
      revenuePerPatient,
      bestPlatform,
      worstPlatform,
      activeCampaigns: activeCampaigns.length,
      avgActiveROI
    }
  }, [campaigns, revenueData])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t('noData')}</p>
            <p className="text-xs mt-2">{t('noDataHint')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <Badge variant="outline" className="text-xs">
                {insights.activeCampaigns} {t('overview.active')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.avgROI')}
            </p>
            <p className={cn(
              'text-2xl font-bold',
              insights.avgROI >= 100 ? 'text-emerald-600' : 'text-blue-600'
            )}>
              {insights.avgROI.toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center mb-2">
              <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.costPerPatient')}
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(insights.costPerPatient * 100)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.revenuePerPatient')}
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(insights.revenuePerPatient * 100)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-2">
              <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.totalPatients')}
            </p>
            <p className="text-2xl font-bold">{insights.totalPatients}</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Best Platform */}
        {insights.bestPlatform && (
          <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                {t('insights.bestPlatform')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
                {insights.bestPlatform.name}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-700 dark:text-emerald-400">ROI:</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-300">
                  {insights.bestPlatform.roi.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-700 dark:text-emerald-400">{t('insights.revenue')}:</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-300">
                  {formatCurrency(insights.bestPlatform.revenue)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warning: Worst Platform */}
        {insights.worstPlatform && insights.worstPlatform.roi < 50 && (
          <Card className="border-2 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {t('insights.needsAttention')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-lg font-bold text-amber-900 dark:text-amber-300">
                {insights.worstPlatform.name}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700 dark:text-amber-400">ROI:</span>
                <span className="font-bold text-amber-900 dark:text-amber-300">
                  {insights.worstPlatform.roi.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                {t('insights.lowROIWarning')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs: ROI Table and Timeline */}
      <Tabs defaultValue="roi" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:max-w-md">
          <TabsTrigger value="roi">{t('tabs.roi')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
        </TabsList>

        <TabsContent value="roi">
          <MarketingROITable campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="timeline">
          <MarketingTimeline events={events} revenueData={revenueData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
