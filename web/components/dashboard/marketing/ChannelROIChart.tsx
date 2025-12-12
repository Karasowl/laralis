'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useClinicCurrency } from '@/hooks/use-clinic-currency'
import { TrendingUp, TrendingDown, Megaphone, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ChannelData {
  channel: string
  roi: number // ROI percentage
  spent_cents: number
  revenue_cents: number
  patients: number
  trend: number[] // Last 6 months for sparkline
}

interface ChannelROIChartProps {
  data: ChannelData[]
  loading?: boolean
  isEmpty?: boolean
}

export function ChannelROIChart({ data, loading, isEmpty }: ChannelROIChartProps) {
  const t = useTranslations('dashboard.marketing')
  const tCommon = useTranslations('common')
  const { format: formatCurrency } = useClinicCurrency()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-64 md:h-72 lg:h-80 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0 || isEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {t('channel_roi')}
          </CardTitle>
          <CardDescription>{t('channel_roi_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 md:h-72 lg:h-80 text-muted-foreground">
            <Megaphone className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <p className="text-center mb-4">{t('no_campaigns_message')}</p>
            <Button asChild>
              <Link href="/marketing">{t('create_first_campaign')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Sort by ROI descending
  const sortedData = [...data].sort((a, b) => b.roi - a.roi)

  // Get color based on ROI performance
  const getBarColor = (roi: number) => {
    if (roi >= 200) return 'hsl(142 76% 36%)' // Emerald - excellent
    if (roi >= 100) return 'hsl(217 91% 60%)' // Blue - good
    if (roi >= 50) return 'hsl(38 92% 50%)' // Amber - acceptable
    return 'hsl(0 84% 60%)' // Red - poor
  }

  // Find best and worst channels
  const bestChannel = sortedData[0]
  const worstChannel = sortedData[sortedData.length - 1]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          {t('channel_roi')}
        </CardTitle>
        <CardDescription>{t('channel_roi_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        <div className="h-64 md:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'ROI %', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                type="category"
                dataKey="channel"
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                content={({ active, payload, label }: any) => {
                  if (active && payload && payload.length) {
                    const channel = payload[0].payload
                    return (
                      <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
                        <p className="font-medium text-foreground mb-2">{label}</p>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">ROI: {payload[0].value.toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">{t('spent')}: {formatCurrency(channel.spent_cents)}</p>
                          <p className="text-xs text-muted-foreground">{t('revenue')}: {formatCurrency(channel.revenue_cents)}</p>
                          <p className="text-xs text-muted-foreground">{t('patients')}: {channel.patients}</p>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="roi" radius={[0, 8, 8, 0]}>
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.roi)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Details */}
        <div className="space-y-3">
          {sortedData.map((channel) => {
            const roiTrend = channel.trend.length >= 2
              ? channel.trend[channel.trend.length - 1] - channel.trend[0]
              : 0
            const isTrendingUp = roiTrend > 0

            return (
              <div
                key={channel.channel}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{channel.channel}</p>
                    {isTrendingUp ? (
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{channel.patients} {t('patients')}</span>
                    <span>{formatCurrency(channel.spent_cents)} {t('spent')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant={channel.roi >= 100 ? "default" : "outline"}
                    className={channel.roi >= 200 ? 'bg-emerald-500' : ''}
                  >
                    {channel.roi.toFixed(0)}% ROI
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>

        {/* Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                {t('best_channel')}
              </p>
            </div>
            <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
              {bestChannel.channel}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-200">
              {bestChannel.roi.toFixed(0)}% ROI · {bestChannel.patients} {t('patients')}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('needs_optimization')}
              </p>
            </div>
            <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
              {worstChannel.channel}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {worstChannel.roi.toFixed(0)}% ROI · {t('optimize_message')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
