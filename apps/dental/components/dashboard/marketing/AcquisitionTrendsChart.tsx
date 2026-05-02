'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Users, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Badge } from '@/components/ui/badge'

interface MonthlyData {
  month: string
  patients: number
  projection?: number
}

interface AcquisitionTrendsChartProps {
  data: MonthlyData[]
  loading?: boolean
}

export function AcquisitionTrendsChart({ data, loading }: AcquisitionTrendsChartProps) {
  const t = useTranslations('dashboard.marketing')
  const tCommon = useTranslations('common')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('acquisition_trends')}
          </CardTitle>
          <CardDescription>{t('acquisition_trends_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>{t('no_data')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate trend - simple linear regression
  const historicalData = data.filter(d => !d.projection)
  const n = historicalData.length
  const sumX = historicalData.reduce((sum, _, i) => sum + i, 0)
  const sumY = historicalData.reduce((sum, d) => sum + d.patients, 0)
  const sumXY = historicalData.reduce((sum, d, i) => sum + (i * d.patients), 0)
  const sumX2 = historicalData.reduce((sum, _, i) => sum + (i * i), 0)

  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0
  const intercept = (sumY - slope * sumX) / n

  // Calculate growth rate
  const firstMonth = historicalData[0]?.patients || 0
  const lastMonth = historicalData[historicalData.length - 1]?.patients || 0
  const growthRate = firstMonth > 0 ? ((lastMonth - firstMonth) / firstMonth) * 100 : 0

  // Determine trend status
  const trendStatus = growthRate > 10
    ? { label: t('strong_growth'), color: 'bg-emerald-500', icon: TrendingUp, iconColor: 'text-emerald-600' }
    : growthRate > 0
    ? { label: t('moderate_growth'), color: 'bg-blue-500', icon: TrendingUp, iconColor: 'text-blue-600' }
    : growthRate > -10
    ? { label: t('stable'), color: 'bg-gray-500', icon: Users, iconColor: 'text-gray-600' }
    : { label: t('declining'), color: 'bg-red-500', icon: AlertCircle, iconColor: 'text-red-600' }

  const TrendIcon = trendStatus.icon

  // Average patients per month
  const avgPatients = historicalData.length > 0
    ? historicalData.reduce((sum, d) => sum + d.patients, 0) / historicalData.length
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('acquisition_trends')}
            </CardTitle>
            <CardDescription>{t('acquisition_trends_description')}</CardDescription>
          </div>
          <Badge variant="outline" className={trendStatus.color + ' text-white'}>
            <TrendIcon className="h-3 w-3 mr-1" />
            {trendStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />

              {/* Average reference line */}
              <ReferenceLine
                y={avgPatients}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{ value: t('average'), position: 'right', fill: 'hsl(var(--muted-foreground))' }}
              />

              {/* Historical data */}
              <Line
                type="monotone"
                dataKey="patients"
                stroke="hsl(217 91% 60%)"
                strokeWidth={2}
                dot={{ fill: 'hsl(217 91% 60%)', r: 4 }}
                activeDot={{ r: 6 }}
                name={t('actual_patients')}
              />

              {/* Projection data */}
              <Line
                type="monotone"
                dataKey="projection"
                stroke="hsl(217 91% 60%)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: 'hsl(217 91% 60%)', r: 4 }}
                name={t('projection')}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('growth_rate')}</p>
            <p className={`text-2xl font-bold ${trendStatus.iconColor}`}>
              {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('avg_monthly')}</p>
            <p className="text-2xl font-bold">{Math.round(avgPatients)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('last_month')}</p>
            <p className="text-2xl font-bold">{lastMonth}</p>
          </div>
        </div>

        {/* Insight */}
        {growthRate > 10 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-900 dark:text-emerald-100">
              <span className="font-medium">{t('excellent_acquisition')}</span>
              {' '}{t('excellent_acquisition_desc', { rate: growthRate.toFixed(1) })}
            </p>
          </div>
        )}

        {growthRate < -10 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-900 dark:text-red-100">
              <span className="font-medium">{t('declining_acquisition')}</span>
              {' '}{t('declining_acquisition_desc')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
