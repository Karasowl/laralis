'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useClinicCurrency } from '@/hooks/use-clinic-currency'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface CACMonthlyData {
  month: string
  cac_cents: number
}

interface CACTrendChartProps {
  data: CACMonthlyData[]
  targetCAC: number // Target CAC in cents
  loading?: boolean
}

export function CACTrendChart({ data, targetCAC, loading }: CACTrendChartProps) {
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

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('cac_evolution')}
          </CardTitle>
          <CardDescription>{t('cac_evolution_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 md:h-72 lg:h-80 text-muted-foreground">
            <DollarSign className="h-8 w-8 mb-2" />
            <p>{t('no_data')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate statistics
  const currentCAC = data[data.length - 1]?.cac_cents || 0
  const previousCAC = data[data.length - 2]?.cac_cents || currentCAC
  const changePercent = previousCAC > 0 ? ((currentCAC - previousCAC) / previousCAC) * 100 : 0

  const avgCAC = data.reduce((sum, d) => sum + d.cac_cents, 0) / data.length

  // FIXED: Lower CAC is better - inverted logic
  // If current CAC is ABOVE target → bad (need attention)
  // If current CAC is BELOW target → good (optimal/excellent)
  const isAboveTarget = currentCAC > targetCAC
  const targetDiff = ((currentCAC - targetCAC) / targetCAC) * 100

  // Determine trend - Lower CAC is better
  const isImproving = changePercent < 0 // Negative change = improvement

  // FIXED: Inverted status logic - lower CAC is better
  const trendStatus = isAboveTarget
    ? { label: t('needs_attention'), color: 'bg-amber-500', icon: AlertTriangle, iconColor: 'text-amber-600' }
    : currentCAC < avgCAC * 0.8 // 20% below average = excellent
    ? { label: t('excellent'), color: 'bg-emerald-500', icon: TrendingDown, iconColor: 'text-emerald-600' }
    : { label: t('good'), color: 'bg-blue-500', icon: TrendingDown, iconColor: 'text-blue-600' }

  const TrendIcon = trendStatus.icon

  // Format data for display
  const chartData = data.map(d => ({
    ...d,
    cac: d.cac_cents / 100, // Convert to dollars for easier chart reading
    target: targetCAC / 100
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t('cac_evolution')}
            </CardTitle>
            <CardDescription>{t('cac_evolution_description')}</CardDescription>
          </div>
          <Badge variant="outline" className={trendStatus.color + ' text-white'}>
            <TrendIcon className="h-3 w-3 mr-1" />
            {trendStatus.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart */}
        <div className="h-64 md:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="cacGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isAboveTarget ? 'hsl(0 84% 60%)' : 'hsl(217 91% 60%)'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isAboveTarget ? 'hsl(0 84% 60%)' : 'hsl(217 91% 60%)'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'CAC']}
              />

              {/* Target reference line */}
              <ReferenceLine
                y={targetCAC / 100}
                stroke="hsl(142 76% 36%)"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: t('target'),
                  position: 'right',
                  fill: 'hsl(142 76% 36%)',
                  fontSize: 12,
                  fontWeight: 500
                }}
              />

              {/* CAC area and line */}
              <Area
                type="monotone"
                dataKey="cac"
                stroke={isAboveTarget ? 'hsl(0 84% 60%)' : 'hsl(217 91% 60%)'}
                strokeWidth={2}
                fill="url(#cacGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('current_cac')}</p>
            <p className={`text-2xl font-bold ${trendStatus.iconColor}`}>
              {formatCurrency(currentCAC)}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {isImproving ? (
                <TrendingDown className="h-3 w-3 text-emerald-600" />
              ) : (
                <TrendingUp className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${isImproving ? 'text-emerald-600' : 'text-red-600'}`}>
                {Math.abs(changePercent).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('target_cac')}</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(targetCAC)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAboveTarget ? t('above') : t('below')} {Math.abs(targetDiff).toFixed(0)}%
            </p>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t('avg_cac')}</p>
            <p className="text-2xl font-bold">{formatCurrency(Math.round(avgCAC))}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('last_12_months')}</p>
          </div>
        </div>

        {/* Alert - FIXED: Show warning when CAC is ABOVE target (bad) */}
        {isAboveTarget && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                <span className="font-medium">{t('cac_alert_title')}</span>
                {' '}{t('cac_alert_desc', { diff: Math.abs(targetDiff).toFixed(0) })}
              </p>
            </div>
          </div>
        )}

        {/* Success message - Show when CAC is BELOW target and improving */}
        {!isAboveTarget && isImproving && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <TrendingDown className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                <span className="font-medium">{t('cac_improving')}</span>
                {' '}{t('cac_improving_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Excellent message - Show when CAC is significantly below target */}
        {!isAboveTarget && !isImproving && currentCAC < avgCAC * 0.8 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <TrendingDown className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                <span className="font-medium">{t('excellent_cac')}</span>
                {' '}{t('excellent_cac_desc')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
