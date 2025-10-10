'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/use-api'
import { formatCurrency } from '@/lib/money'
import type { BusinessInsights } from '@/lib/analytics'
import {
  Users,
  Megaphone,
  DollarSign,
  TrendingUp,
  Target,
  AlertTriangle
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'

interface ReportsMarketingProps {
  clinicId?: string
  insights: BusinessInsights | null
  loading: boolean
}

interface Campaign {
  id: string
  name: string
  is_active: boolean
  is_archived: boolean
  platform_name?: string | null
  patients_count?: number | null
}

export function ReportsMarketing({ clinicId, insights, loading }: ReportsMarketingProps) {
  const t = useTranslations('reports')

  const campaignsEndpoint = clinicId ? `/api/marketing/campaigns?clinicId=${clinicId}` : null
  const {
    data: campaignsResponse,
    loading: campaignsLoading,
  } = useApi<{ data: Campaign[] }>(campaignsEndpoint, { autoFetch: Boolean(clinicId) })

  const campaigns = useMemo(() => campaignsResponse?.data ?? [], [campaignsResponse])
  const totalPatientsFromCampaigns = useMemo(
    () => campaigns.reduce((sum, campaign) => sum + (campaign.patients_count || 0), 0),
    [campaigns]
  )
  const activeCampaigns = useMemo(
    () => campaigns.filter(campaign => campaign.is_active && !campaign.is_archived).length,
    [campaigns]
  )
  const dormantCampaigns = useMemo(
    () =>
      campaigns
        .filter(campaign => !campaign.is_archived && (campaign.patients_count || 0) === 0)
        .sort((a, b) => {
          if (a.is_active === b.is_active) {
            return a.name.localeCompare(b.name)
          }
          return a.is_active ? -1 : 1
        })
        .slice(0, 5),
    [campaigns]
  )
  const topCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => (b.patients_count || 0) - (a.patients_count || 0)).slice(0, 5),
    [campaigns]
  )
  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    campaigns.forEach(campaign => {
      const key = campaign.platform_name || t('marketing.campaigns.unknownPlatform')
      map.set(key, (map.get(key) || 0) + (campaign.patients_count || 0))
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [campaigns, t])

  const patientInsights = insights?.patient_insights
  const lifetimeValueDisplay = patientInsights
    ? formatCurrency(patientInsights.lifetime_value)
    : t('marketing.summary.noData')
  const retentionDisplay = patientInsights
    ? `${Math.round((patientInsights.retention_rate || 0) * 100)}%`
    : t('marketing.summary.noData')
  const acquisitionDisplay = patientInsights
    ? patientInsights.acquisition_rate
    : 0

  const combinedLoading = loading || campaignsLoading
  const insightsAvailable = Boolean(
    patientInsights &&
    (patientInsights.lifetime_value > 0 ||
      patientInsights.retention_rate > 0 ||
      patientInsights.acquisition_rate > 0)
  )
  const campaignsAvailable = campaigns.length > 0
  const hasChannelData = channelBreakdown.some(item => item.count > 0)

  if (combinedLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(index => (
            <Card key={index} className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(index => (
            <Card key={index} className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!campaignsAvailable && !insightsAvailable) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t('marketing.noData')}
        </CardContent>
      </Card>
    )
  }

  const summaryCards = [
    {
      title: t('marketing.summary.patientsFromCampaigns'),
      value: totalPatientsFromCampaigns.toLocaleString(),
      icon: Users,
    },
    {
      title: t('marketing.summary.activeCampaigns'),
      value: activeCampaigns.toLocaleString(),
      icon: Megaphone,
    },
    {
      title: t('marketing.summary.lifetimeValue'),
      value: lifetimeValueDisplay,
      icon: DollarSign,
    },
    {
      title: t('marketing.summary.retention'),
      value: retentionDisplay,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold mt-2">{card.value}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              {t('marketing.campaigns.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('marketing.campaigns.empty')}</p>
            ) : (
              topCampaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.platform_name || t('marketing.campaigns.unknownPlatform')}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={campaign.is_active ? 'default' : 'outline'}>
                      {campaign.is_active
                        ? t('marketing.campaigns.status.active')
                        : t('marketing.campaigns.status.inactive')}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {t('marketing.campaigns.patients', {
                        count: campaign.patients_count || 0,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t('marketing.patientInsights.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('marketing.patientInsights.acquisition')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('marketing.patientInsights.acquisitionHint')}
                </p>
              </div>
              <p className="text-lg font-semibold">{acquisitionDisplay.toLocaleString()}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('marketing.patientInsights.retention')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('marketing.patientInsights.retentionHint')}
                </p>
              </div>
              <p className="text-lg font-semibold">{retentionDisplay}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('marketing.patientInsights.lifetimeValue')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('marketing.patientInsights.lifetimeValueHint')}
                </p>
              </div>
              <p className="text-lg font-semibold">{lifetimeValueDisplay}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('marketing.patientInsights.footer')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              {t('marketing.channels.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('marketing.channels.subtitle')}
            </p>
          </CardHeader>
          <CardContent className="h-[320px]">
            {hasChannelData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelBreakdown} layout="vertical" margin={{ top: 10, left: 0, right: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.12)' }}
                    formatter={(value: number) => [
                      t('marketing.campaigns.patients', { count: value }),
                      t('marketing.channels.tooltipLabel')
                    ]}
                  />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('marketing.channels.empty')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('marketing.dormant.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('marketing.dormant.subtitle')}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dormantCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('marketing.dormant.empty')}
              </p>
            ) : (
              dormantCampaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.platform_name || t('marketing.campaigns.unknownPlatform')}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={campaign.is_active ? 'outline' : 'secondary'}>
                      {campaign.is_active
                        ? t('marketing.campaigns.status.active')
                        : t('marketing.campaigns.status.inactive')}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {t('marketing.campaigns.patients', { count: campaign.patients_count || 0 })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <p className="text-xs text-muted-foreground">
              {t('marketing.dormant.hint')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
